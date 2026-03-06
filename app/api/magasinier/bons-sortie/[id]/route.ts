import { NextResponse } from "next/server";
import { StatutBonSortie } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/magasinier/bons-sortie/[id]
 * Détail d'un bon de sortie
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const { id } = await params;
    const bonId = Number(id);
    if (isNaN(bonId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const bon = await prisma.bonSortie.findUnique({
      where: { id: bonId },
      include: {
        lignes: {
          include: { produit: { select: { id: true, nom: true, prixUnitaire: true } } },
        },
        creePar:  { select: { id: true, nom: true, prenom: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (!bon) return NextResponse.json({ error: "Bon introuvable" }, { status: 404 });

    return NextResponse.json({ data: bon });
  } catch (error) {
    console.error("GET /magasinier/bons-sortie/[id]:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

/**
 * PATCH /api/magasinier/bons-sortie/[id]
 * Mettre à jour le statut d'un bon de sortie
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const { id } = await params;
    const bonId = Number(id);
    if (isNaN(bonId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { statut, notes } = body;

    const validStatuts: StatutBonSortie[] = ["BROUILLON", "VALIDE", "ANNULE"];
    if (!statut || !validStatuts.includes(statut)) {
      return NextResponse.json({ error: "Statut invalide (BROUILLON|VALIDE|ANNULE)" }, { status: 400 });
    }

    const bon = await prisma.bonSortie.findUnique({ where: { id: bonId } });
    if (!bon) return NextResponse.json({ error: "Bon introuvable" }, { status: 404 });

    const updated = await prisma.bonSortie.update({
      where: { id: bonId },
      data: {
        statut,
        notes:       notes ?? bon.notes,
        valideParId: statut === "VALIDE" ? parseInt(session.user.id) : bon.valideParId,
      },
      include: {
        lignes:  { include: { produit: { select: { id: true, nom: true } } } },
        creePar: { select: { nom: true, prenom: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /magasinier/bons-sortie/[id]:", error);
    return NextResponse.json({ error: "Erreur lors de la mise a jour" }, { status: 500 });
  }
}
