import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutFinancementRIA } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const financement = await prisma.operationFinancementRIA.findUnique({
      where: { id: parseInt(id) },
      include: {
        portefeuille: {
          include: {
            profilRIA: {
              include: {
                gestionnaire: { include: { member: { select: { id: true, nom: true, prenom: true } } } },
              },
            },
          },
        },
        client:      { select: { id: true, nom: true, prenom: true, telephone: true, adresse: true } },
        creditClient: { select: { id: true, reference: true, statut: true, montantTotal: true } },
        affectation:  { select: { id: true, classeRisque: true, pourcentage: true, montantAlloue: true } },
        remboursements: { orderBy: { createdAt: "asc" } },
        mouvements:     { orderBy: { createdAt: "asc" } },
      },
    });

    if (!financement) return NextResponse.json({ error: "Financement introuvable" }, { status: 404 });
    return NextResponse.json({ data: financement });
  } catch (error) {
    console.error("GET /api/admin/ria/financements/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// action: MARQUER_EN_RETARD | MARQUER_DEFAUT | ANNULER
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const { action, notes } = await req.json();

    const TRANSITIONS: Record<string, StatutFinancementRIA> = {
      MARQUER_EN_RETARD: "EN_RETARD",
      MARQUER_DEFAUT:    "DEFAUT",
      ANNULER:           "ANNULE",
    };

    if (!TRANSITIONS[action]) {
      return NextResponse.json({ error: "action invalide" }, { status: 400 });
    }

    const fin = await prisma.operationFinancementRIA.findUnique({ where: { id: parseInt(id) } });
    if (!fin) return NextResponse.json({ error: "Financement introuvable" }, { status: 404 });

    if (action === "ANNULER") {
      // Restituer le capital engagé au disponible
      await prisma.$transaction(async (tx) => {
        await tx.operationFinancementRIA.update({
          where: { id: fin.id },
          data: { statut: "ANNULE", notes: notes ?? fin.notes },
        });
        if (Number(fin.encours) > 0) {
          await tx.portefeuilleRIA.update({
            where: { id: fin.portefeuilleId },
            data: {
              capitalEngage:     { decrement: Number(fin.encours) },
              capitalDisponible: { increment: Number(fin.encours) },
            },
          });
          await tx.mouvementFondsRIA.create({
            data: {
              type:           "AJUSTEMENT",
              montant:        fin.encours,
              sens:           "CREDIT",
              description:    `Annulation financement ${fin.reference} — encours restitué`,
              portefeuilleId: fin.portefeuilleId,
              financementId:  fin.id,
            },
          });
        }
      });
    } else {
      await prisma.operationFinancementRIA.update({
        where: { id: fin.id },
        data: { statut: TRANSITIONS[action], notes: notes ?? fin.notes },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/admin/ria/financements/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
