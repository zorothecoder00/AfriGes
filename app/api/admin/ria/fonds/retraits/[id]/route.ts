import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { ecritureRetraitRIA } from "@/lib/riaComptable";

type Ctx = { params: Promise<{ id: string }> };

// action: VALIDER | PAYER | REJETER
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { action, notes } = body; // VALIDER | PAYER | REJETER (absent => édition)

    const retrait = await prisma.retraitInvestisseur.findUnique({ where: { id: parseInt(id) } });
    if (!retrait) return NextResponse.json({ error: "Retrait introuvable" }, { status: 404 });

    // ── Mode édition (pas d'action) : modifier un retrait encore en attente ────────
    if (!action) {
      if (retrait.statut !== "EN_ATTENTE") {
        return NextResponse.json({ error: "Seul un retrait en attente peut être modifié" }, { status: 400 });
      }
      const { portefeuilleId, montant, motif, modePaiement } = body;
      const cibleMontant = montant !== undefined ? Number(montant) : Number(retrait.montant);
      const ciblePfId = portefeuilleId !== undefined ? Number(portefeuilleId) : retrait.portefeuilleId;

      if (montant !== undefined && cibleMontant <= 0) {
        return NextResponse.json({ error: "Le montant doit être supérieur à 0" }, { status: 400 });
      }
      // Vérifier que le portefeuille (nouveau ou actuel) peut couvrir le montant cible.
      if (montant !== undefined || portefeuilleId !== undefined) {
        const pf = await prisma.portefeuilleRIA.findUnique({ where: { id: ciblePfId } });
        if (!pf) return NextResponse.json({ error: "Portefeuille introuvable" }, { status: 404 });
        if (Number(pf.capitalDisponible) < cibleMontant) {
          return NextResponse.json({ error: "Capital disponible insuffisant" }, { status: 400 });
        }
      }

      const data: Record<string, unknown> = {};
      if (montant !== undefined) data.montant = cibleMontant;
      if (portefeuilleId !== undefined) data.portefeuilleId = ciblePfId;
      if (motif !== undefined) data.motif = motif ?? null;
      if (modePaiement !== undefined) data.modePaiement = modePaiement ?? null;
      if (notes !== undefined) data.notes = notes ?? null;

      if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
      }
      const updated = await prisma.retraitInvestisseur.update({ where: { id: retrait.id }, data });
      return NextResponse.json({ data: updated });
    }

    if (!["VALIDER", "PAYER", "REJETER"].includes(action)) {
      return NextResponse.json({ error: "action doit être VALIDER, PAYER ou REJETER" }, { status: 400 });
    }

    const adminId = parseInt(session.user.id);
    const now = new Date();

    if (action === "VALIDER") {
      if (retrait.statut !== "EN_ATTENTE") {
        return NextResponse.json({ error: "Statut actuel ne permet pas cette action" }, { status: 400 });
      }
      await prisma.retraitInvestisseur.update({
        where: { id: retrait.id },
        data: { statut: "VALIDE", valideParId: adminId, dateValidation: now, notes: notes ?? retrait.notes },
      });
    } else if (action === "PAYER") {
      if (retrait.statut !== "VALIDE") {
        return NextResponse.json({ error: "Le retrait doit être validé avant d'être payé" }, { status: 400 });
      }
      const pf = await prisma.portefeuilleRIA.findUnique({
        where: { id: retrait.portefeuilleId },
        select: { profilRIA: { select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } } } },
      });
      const mem = pf?.profilRIA?.gestionnaire?.member;
      const investisseurNom = mem ? `${mem.prenom} ${mem.nom}` : "Investisseur";

      await prisma.$transaction(async (tx) => {
        await tx.retraitInvestisseur.update({
          where: { id: retrait.id },
          data: { statut: "PAYE", datePaiement: now, notes: notes ?? retrait.notes },
        });

        await tx.portefeuilleRIA.update({
          where: { id: retrait.portefeuilleId },
          data: { capitalDisponible: { decrement: Number(retrait.montant) } },
        });

        await tx.mouvementFondsRIA.create({
          data: {
            type:          "RETRAIT",
            montant:       retrait.montant,
            sens:          "DEBIT",
            description:   `Retrait payé — réf. ${retrait.reference}`,
            reference:     retrait.reference,
            portefeuilleId: retrait.portefeuilleId,
            retraitId:     retrait.id,
          },
        });

        await ecritureRetraitRIA(tx, {
          montant: Number(retrait.montant),
          reference: retrait.reference,
          investisseurNom,
          userId: adminId,
        });
      });
    } else {
      if (!["EN_ATTENTE", "VALIDE"].includes(retrait.statut)) {
        return NextResponse.json({ error: "Ce retrait ne peut plus être rejeté" }, { status: 400 });
      }
      await prisma.retraitInvestisseur.update({
        where: { id: retrait.id },
        data: { statut: "REJETE", valideParId: adminId, dateValidation: now, notes: notes ?? retrait.notes },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/admin/ria/fonds/retraits/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
