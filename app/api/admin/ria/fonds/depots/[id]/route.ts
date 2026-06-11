import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { ecritureDépôtRIA } from "@/lib/riaComptable";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
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
      const pf = await prisma.portefeuilleRIA.findUnique({
        where: { id: depot.portefeuilleId },
        select: { profilRIA: { select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } } } },
      });
      const mem = pf?.profilRIA?.gestionnaire?.member;
      const investisseurNom = mem ? `${mem.prenom} ${mem.nom}` : "Investisseur";

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

        await ecritureDépôtRIA(tx, {
          montant: Number(depot.montant),
          reference: depot.reference,
          investisseurNom,
          userId: adminId,
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
