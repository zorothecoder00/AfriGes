import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const { montant, remboursementCreditId } = await req.json();

    if (!montant || Number(montant) <= 0) {
      return NextResponse.json({ error: "montant doit être > 0" }, { status: 400 });
    }

    const fin = await prisma.operationFinancementRIA.findUnique({ where: { id: parseInt(id) } });
    if (!fin) return NextResponse.json({ error: "Financement introuvable" }, { status: 404 });
    if (fin.statut === "ANNULE") return NextResponse.json({ error: "Ce financement est annulé" }, { status: 400 });

    const montantRemb = Math.min(Number(montant), Number(fin.encours));
    if (montantRemb <= 0) {
      return NextResponse.json({ error: "L'encours est déjà soldé" }, { status: 400 });
    }

    const nouveauEncours    = Number(fin.encours) - montantRemb;
    const nouveauRembourse  = Number(fin.montantRembourse) + montantRemb;
    const totalRemb = await prisma.remboursementRIA.count({ where: { financementId: fin.id } });

    await prisma.$transaction(async (tx) => {
      await tx.remboursementRIA.create({
        data: {
          financementId:         fin.id,
          montant:               montantRemb,
          remboursementCreditId: remboursementCreditId ? parseInt(remboursementCreditId) : null,
        },
      });

      await tx.operationFinancementRIA.update({
        where: { id: fin.id },
        data: {
          montantRembourse: nouveauRembourse,
          encours:          nouveauEncours,
          statut:           nouveauEncours <= 0 ? "REMBOURSE" : fin.statut === "DEFAUT" ? "DEFAUT" : fin.statut === "EN_RETARD" ? "EN_RETARD" : "ACTIF",
        },
      });

      await tx.portefeuilleRIA.update({
        where: { id: fin.portefeuilleId },
        data: {
          capitalEngage:     { decrement: montantRemb },
          capitalRecouvre:   { increment: montantRemb },
          capitalDisponible: { increment: montantRemb },
        },
      });

      await tx.mouvementFondsRIA.create({
        data: {
          type:          "REMBOURSEMENT_CLIENT",
          montant:       montantRemb,
          sens:          "CREDIT",
          description:   `Remboursement #${totalRemb + 1} sur ${fin.reference}`,
          reference:     fin.reference,
          portefeuilleId: fin.portefeuilleId,
          financementId: fin.id,
        },
      });
    });

    return NextResponse.json({ success: true, nouveauEncours, estSolde: nouveauEncours <= 0 });
  } catch (error) {
    console.error("POST /api/admin/ria/financements/[id]/remboursements", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
