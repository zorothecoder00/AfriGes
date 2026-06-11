import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

/**
 * GET  /api/admin/ria/benefices/distributions
 * PATCH /api/admin/ria/benefices/distributions
 *
 * GET  — liste toutes les DistributionBenefice avec stats portefeuille
 * PATCH — { id, action: "DISTRIBUER" }
 *   PLANIFIE → EN_ATTENTE_PAIEMENT → DISTRIBUE
 *   Effet : portefeuille.capitalDisponible   += montantDistribue + montantReinvesti
 *           portefeuille.capitalInvesti       += montantReinvesti
 *           portefeuille.beneficesDistribues  += montantDistribue
 *           portefeuille.beneficesReinvestis  += montantReinvesti
 *           portefeuille.fondSecurite         += montantFondSecurite
 *           + 3 MouvementFondsRIA (DISTRIBUE, REINVESTI, FOND_SECURITE)
 */

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut      = searchParams.get("statut");
    const mois        = searchParams.get("mois")   ? parseInt(searchParams.get("mois")!)   : undefined;
    const annee       = searchParams.get("annee")  ? parseInt(searchParams.get("annee")!)  : undefined;
    const pfId        = searchParams.get("portefeuilleId") ? parseInt(searchParams.get("portefeuilleId")!) : undefined;

    const distributions = await prisma.distributionBenefice.findMany({
      where: {
        ...(statut ? { statut: statut as never } : {}),
        ...(mois   ? { mois }  : {}),
        ...(annee  ? { annee } : {}),
        ...(pfId   ? { portefeuilleId: pfId } : {}),
      },
      include: {
        portefeuille: {
          select: {
            id: true,
            reference: true,
            nom: true,
            capitalEngage: true,
            capitalDisponible: true,
            profilRIA: { select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } } },
          },
        },
      },
      orderBy: [{ annee: "desc" }, { mois: "desc" }],
    });

    const totaux = distributions.reduce(
      (acc, d) => ({
        genere:    acc.genere    + Number(d.montantGenere),
        distribue: acc.distribue + Number(d.montantDistribue),
        reinvesti: acc.reinvesti + Number(d.montantReinvesti),
        securite:  acc.securite  + Number(d.montantFondSecurite),
      }),
      { genere: 0, distribue: 0, reinvesti: 0, securite: 0 }
    );

    return NextResponse.json({ distributions, totaux, total: distributions.length });
  } catch (error) {
    console.error("GET /api/admin/ria/benefices/distributions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { id, action } = body as { id: number; action: "DISTRIBUER" };

    if (!id || action !== "DISTRIBUER") {
      return NextResponse.json({ error: "id et action DISTRIBUER requis" }, { status: 400 });
    }

    const distrib = await prisma.distributionBenefice.findUnique({ where: { id } });
    if (!distrib) return NextResponse.json({ error: "Distribution introuvable" }, { status: 404 });

    if (!["PLANIFIE", "EN_ATTENTE_PAIEMENT"].includes(distrib.statut)) {
      return NextResponse.json({ error: `Distribution déjà ${distrib.statut.toLowerCase()}` }, { status: 400 });
    }

    const userId = parseInt(session.user.id);

    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.distributionBenefice.update({
        where: { id },
        data: {
          statut:      "DISTRIBUE",
          datePaiement: new Date(),
          traitePar:   userId,
        },
      });

      // Effet sur le portefeuille
      await tx.portefeuilleRIA.update({
        where: { id: distrib.portefeuilleId },
        data: {
          capitalDisponible:  { increment: Number(d.montantDistribue) + Number(d.montantReinvesti) },
          capitalInvesti:     { increment: Number(d.montantReinvesti) },
          beneficesDistribues: { increment: Number(d.montantDistribue) },
          beneficesReinvestis: { increment: Number(d.montantReinvesti) },
          fondSecurite:       { increment: Number(d.montantFondSecurite) },
        },
      });

      // 3 mouvements
      await tx.mouvementFondsRIA.createMany({
        data: [
          {
            portefeuilleId: distrib.portefeuilleId,
            type:           "BENEFICE_DISTRIBUE",
            sens:           "DEBIT",
            montant:        Number(d.montantDistribue),
            distributionId: id,
            description:    `Distribution bénéfice ${d.mois}/${d.annee}`,
          },
          {
            portefeuilleId: distrib.portefeuilleId,
            type:           "BENEFICE_REINVESTI",
            sens:           "CREDIT",
            montant:        Number(d.montantReinvesti),
            distributionId: id,
            description:    `Réinvestissement bénéfice ${d.mois}/${d.annee}`,
          },
          {
            portefeuilleId: distrib.portefeuilleId,
            type:           "FOND_SECURITE",
            sens:           "CREDIT",
            montant:        Number(d.montantFondSecurite),
            distributionId: id,
            description:    `Fonds sécurité ${d.mois}/${d.annee}`,
          },
        ],
      });

      return d;
    });

    return NextResponse.json({ success: true, distributionId: updated.id });
  } catch (error) {
    console.error("PATCH /api/admin/ria/benefices/distributions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
