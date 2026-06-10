import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

// action: VALIDER | PAYER | REJETER
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const { action, notes } = await req.json();

    if (!["VALIDER", "PAYER", "REJETER"].includes(action)) {
      return NextResponse.json({ error: "action doit être VALIDER, PAYER ou REJETER" }, { status: 400 });
    }

    const retrait = await prisma.retraitInvestisseur.findUnique({ where: { id: parseInt(id) } });
    if (!retrait) return NextResponse.json({ error: "Retrait introuvable" }, { status: 404 });

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
