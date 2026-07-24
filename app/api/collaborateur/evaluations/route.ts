import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getCollaborateurProfilRH } from "@/lib/authCollaborateur";

/**
 * GET /api/collaborateur/evaluations
 * Liste en lecture seule des fiches d'évaluation du collaborateur connecté.
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const userId = parseInt(session.user.id);
    const profil = await getCollaborateurProfilRH(userId);
    if (!profil) return NextResponse.json({ data: [] });

    // BROUILLON exclu : évaluation pas encore engagée côté RH (objectifs non fixés).
    const evaluations = await prisma.evaluationRH.findMany({
      where: { profilRHId: profil.id, statut: { not: "BROUILLON" } },
      orderBy: [{ annee: "desc" }, { createdAt: "desc" }],
      select: {
        id: true, periode: true, annee: true, statut: true, typeEvaluation: true,
        noteGlobale: true, dateDebut: true, dateFin: true,
        evaluateur: {
          select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } },
        },
      },
    });

    return NextResponse.json({ data: evaluations });
  } catch (error) {
    console.error("GET /api/collaborateur/evaluations", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
