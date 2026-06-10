import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const { action, notes } = await req.json(); // action: VALIDER | REJETER

    if (!["VALIDER", "REJETER"].includes(action)) {
      return NextResponse.json({ error: "action doit être VALIDER ou REJETER" }, { status: 400 });
    }

    const depot = await prisma.depotInvestisseur.findUnique({ where: { id: parseInt(id) } });
    if (!depot) return NextResponse.json({ error: "Dépôt introuvable" }, { status: 404 });
    if (depot.statut !== "EN_ATTENTE") {
      return NextResponse.json({ error: "Ce dépôt a déjà été traité" }, { status: 400 });
    }

    const adminId = parseInt(session.user.id);

    if (action === "VALIDER") {
      await prisma.$transaction(async (tx) => {
        await tx.depotInvestisseur.update({
          where: { id: depot.id },
          data: { statut: "VALIDE", valideParId: adminId, dateValidation: new Date(), notes: notes ?? depot.notes },
        });

        await tx.portefeuilleRIA.update({
          where: { id: depot.portefeuilleId },
          data: {
            capitalInvesti:    { increment: Number(depot.montant) },
            capitalDisponible: { increment: Number(depot.montant) },
          },
        });

        await tx.mouvementFondsRIA.create({
          data: {
            type:          "DEPOT",
            montant:       depot.montant,
            sens:          "CREDIT",
            description:   `Dépôt validé — réf. ${depot.reference}`,
            reference:     depot.reference,
            portefeuilleId: depot.portefeuilleId,
            depotId:       depot.id,
          },
        });
      });
    } else {
      await prisma.depotInvestisseur.update({
        where: { id: depot.id },
        data: { statut: "REJETE", valideParId: adminId, dateValidation: new Date(), notes: notes ?? depot.notes },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/admin/ria/fonds/depots/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
