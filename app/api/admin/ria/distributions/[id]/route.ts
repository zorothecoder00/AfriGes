import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { ecritureDistributionRIA } from "@/lib/riaComptable";

type Ctx = { params: Promise<{ id: string }> };

// action: TRAITER — distribue + réinvestit + fonds sécurité en une seule transaction
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const { action, notes } = await req.json();

    if (action !== "TRAITER") {
      return NextResponse.json({ error: "action doit être TRAITER" }, { status: 400 });
    }

    const dist = await prisma.distributionBenefice.findUnique({ where: { id: parseInt(id) } });
    if (!dist) return NextResponse.json({ error: "Distribution introuvable" }, { status: 404 });
    if (dist.statut !== "PLANIFIE") {
      return NextResponse.json({ error: "Cette distribution a déjà été traitée" }, { status: 400 });
    }

    const adminId       = parseInt(session.user.id);
    const distrib       = Number(dist.montantDistribue);
    const reinvesti     = Number(dist.montantReinvesti);
    const fondSec       = Number(dist.montantFondSecurite);
    const genere        = Number(dist.montantGenere);
    const MOIS_LABELS   = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    const periode       = `${MOIS_LABELS[dist.mois]} ${dist.annee}`;

    const pf = await prisma.portefeuilleRIA.findUnique({
      where: { id: dist.portefeuilleId },
      select: { reference: true },
    });
    const portefeuilleRef = pf?.reference ?? `PF-${dist.portefeuilleId}`;

    await prisma.$transaction(async (tx) => {
      // Mise à jour portefeuille
      await tx.portefeuilleRIA.update({
        where: { id: dist.portefeuilleId },
        data: {
          capitalDisponible:   { increment: distrib + reinvesti },
          capitalInvesti:      { increment: reinvesti },
          beneficesGeneres:    { increment: genere },
          beneficesDistribues: { increment: distrib },
          beneficesReinvestis: { increment: reinvesti },
          fondSecurite:        { increment: fondSec },
        },
      });

      // 3 mouvements
      if (distrib > 0) {
        await tx.mouvementFondsRIA.create({
          data: {
            type:           "BENEFICE_DISTRIBUE",
            montant:        distrib,
            sens:           "CREDIT",
            description:    `Distribution bénéfices ${periode}`,
            portefeuilleId: dist.portefeuilleId,
            distributionId: dist.id,
          },
        });
      }
      if (reinvesti > 0) {
        await tx.mouvementFondsRIA.create({
          data: {
            type:           "BENEFICE_REINVESTI",
            montant:        reinvesti,
            sens:           "CREDIT",
            description:    `Réinvestissement automatique ${periode}`,
            portefeuilleId: dist.portefeuilleId,
            distributionId: dist.id,
          },
        });
      }
      if (fondSec > 0) {
        await tx.mouvementFondsRIA.create({
          data: {
            type:           "FOND_SECURITE",
            montant:        fondSec,
            sens:           "CREDIT",
            description:    `Fonds de sécurité ${periode}`,
            portefeuilleId: dist.portefeuilleId,
            distributionId: dist.id,
          },
        });
      }

      // Marquer distribution traitée
      await tx.distributionBenefice.update({
        where: { id: dist.id },
        data: {
          statut:      "DISTRIBUE",
          datePaiement: new Date(),
          traitePar:   adminId,
          notes:       notes ?? dist.notes,
        },
      });

      await ecritureDistributionRIA(tx, {
        montantDistribue:  distrib,
        montantReinvesti:  reinvesti,
        montantSecurite:   fondSec,
        mois:              dist.mois,
        annee:             dist.annee,
        portefeuilleRef,
        userId:            adminId,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/admin/ria/distributions/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
