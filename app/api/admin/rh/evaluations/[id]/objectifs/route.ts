import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/rh/evaluations/[id]/objectifs
 * Liste des objectifs KPI d'une évaluation.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const eval_ = await prisma.evaluationRH.findUnique({ where: { id: Number(id) } });
    if (!eval_) return NextResponse.json({ error: "Évaluation introuvable" }, { status: 404 });

    const objectifs = await prisma.objectifKPI.findMany({
      where:   { evaluationId: Number(id) },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ data: objectifs });
  } catch (error) {
    console.error("GET /api/admin/rh/evaluations/[id]/objectifs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/evaluations/[id]/objectifs
 * Ajouter un objectif KPI.
 * Body: { libelle, valeurCible, indicateur?, unite?, poids?, commentaire? }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { libelle, valeurCible, indicateur, unite, poids, commentaire } = body;

    if (!libelle || valeurCible === undefined || valeurCible === null) {
      return NextResponse.json({ error: "libelle et valeurCible sont requis" }, { status: 400 });
    }

    const eval_ = await prisma.evaluationRH.findUnique({ where: { id: Number(id) } });
    if (!eval_) return NextResponse.json({ error: "Évaluation introuvable" }, { status: 404 });

    const kpi = await prisma.objectifKPI.create({
      data: {
        evaluationId: Number(id),
        libelle,
        valeurCible:  Number(valeurCible),
        indicateur:   indicateur   ?? null,
        unite:        unite        ?? null,
        poids:        poids        !== undefined ? Number(poids) : null,
        commentaire:  commentaire  ?? null,
      },
    });
    return NextResponse.json({ data: kpi }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/evaluations/[id]/objectifs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/rh/evaluations/[id]/objectifs
 * Mettre à jour un objectif KPI (valeurAtteinte, libelle, etc.).
 * Body: { kpiId, valeurAtteinte?, libelle?, indicateur?, valeurCible?, unite?, poids?, commentaire? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { kpiId, valeurAtteinte, libelle, indicateur, valeurCible, unite, poids, commentaire } = body;

    if (!kpiId) return NextResponse.json({ error: "kpiId requis" }, { status: 400 });

    const existing = await prisma.objectifKPI.findFirst({
      where: { id: Number(kpiId), evaluationId: Number(id) },
    });
    if (!existing) return NextResponse.json({ error: "KPI introuvable" }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (libelle        !== undefined) data.libelle        = libelle;
    if (indicateur     !== undefined) data.indicateur     = indicateur     ?? null;
    if (valeurCible    !== undefined) data.valeurCible    = Number(valeurCible);
    if (valeurAtteinte !== undefined) data.valeurAtteinte = valeurAtteinte !== null ? Number(valeurAtteinte) : null;
    if (unite          !== undefined) data.unite          = unite          ?? null;
    if (poids          !== undefined) data.poids          = poids          !== null ? Number(poids) : null;
    if (commentaire    !== undefined) data.commentaire    = commentaire    ?? null;

    const updated = await prisma.objectifKPI.update({ where: { id: Number(kpiId) }, data });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/evaluations/[id]/objectifs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/rh/evaluations/[id]/objectifs
 * Supprimer un objectif KPI.
 * Body: { kpiId }
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id }    = await params;
    const { kpiId } = await req.json();
    if (!kpiId) return NextResponse.json({ error: "kpiId requis" }, { status: 400 });

    const existing = await prisma.objectifKPI.findFirst({
      where: { id: Number(kpiId), evaluationId: Number(id) },
    });
    if (!existing) return NextResponse.json({ error: "KPI introuvable" }, { status: 404 });

    await prisma.objectifKPI.delete({ where: { id: Number(kpiId) } });
    return NextResponse.json({ message: "KPI supprimé" });
  } catch (error) {
    console.error("DELETE /api/admin/rh/evaluations/[id]/objectifs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
