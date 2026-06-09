import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { NiveauCompetence } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/rh/collaborateurs/[id]/competences
 * Compétences d'un collaborateur (profilRH.id).
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;

    const profil = await prisma.profilRH.findUnique({ where: { id: Number(id) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    const competences = await prisma.collaborateurCompetence.findMany({
      where:   { profilRHId: Number(id) },
      include: { competence: true },
      orderBy: [{ competence: { type: "asc" } }, { competence: { categorie: "asc" } }, { competence: { nom: "asc" } }],
    });

    return NextResponse.json({ data: competences });
  } catch (error) {
    console.error("GET /api/admin/rh/collaborateurs/[id]/competences", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/collaborateurs/[id]/competences
 * Ajouter ou mettre à jour une compétence pour un collaborateur (upsert).
 * Body: { competenceId, niveau, dateAcquisition?, notes? }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { competenceId, niveau, dateAcquisition, notes } = body;

    if (!competenceId || !niveau) {
      return NextResponse.json({ error: "competenceId et niveau sont requis" }, { status: 400 });
    }

    const NIVEAUX: NiveauCompetence[] = ["DEBUTANT", "INTERMEDIAIRE", "AVANCE", "EXPERT"];
    if (!NIVEAUX.includes(niveau as NiveauCompetence)) {
      return NextResponse.json({ error: "niveau invalide" }, { status: 400 });
    }

    const profil = await prisma.profilRH.findUnique({ where: { id: Number(id) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    const comp = await prisma.competence.findUnique({ where: { id: Number(competenceId) } });
    if (!comp) return NextResponse.json({ error: "Compétence introuvable" }, { status: 404 });

    const result = await prisma.collaborateurCompetence.upsert({
      where: { profilRHId_competenceId: { profilRHId: Number(id), competenceId: Number(competenceId) } },
      create: {
        profilRHId:      Number(id),
        competenceId:    Number(competenceId),
        niveau:          niveau as NiveauCompetence,
        dateAcquisition: dateAcquisition ? new Date(dateAcquisition) : null,
        notes:           notes ?? null,
        evalueParId:     parseInt(session.user.id),
      },
      update: {
        niveau:          niveau as NiveauCompetence,
        dateAcquisition: dateAcquisition ? new Date(dateAcquisition) : null,
        notes:           notes           ?? null,
        evalueParId:     parseInt(session.user.id),
      },
      include: { competence: true },
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/collaborateurs/[id]/competences", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/rh/collaborateurs/[id]/competences
 * Retirer une compétence d'un collaborateur.
 * Body: { competenceId }
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const { competenceId } = await req.json();

    if (!competenceId) return NextResponse.json({ error: "competenceId requis" }, { status: 400 });

    const existing = await prisma.collaborateurCompetence.findUnique({
      where: { profilRHId_competenceId: { profilRHId: Number(id), competenceId: Number(competenceId) } },
    });
    if (!existing) return NextResponse.json({ error: "Compétence non assignée" }, { status: 404 });

    await prisma.collaborateurCompetence.delete({
      where: { profilRHId_competenceId: { profilRHId: Number(id), competenceId: Number(competenceId) } },
    });

    return NextResponse.json({ message: "Compétence retirée" });
  } catch (error) {
    console.error("DELETE /api/admin/rh/collaborateurs/[id]/competences", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
