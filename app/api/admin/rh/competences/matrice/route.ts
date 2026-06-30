import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/competences/matrice
 * Matrice compétences × collaborateurs.
 * Query: departement?, type?, categorie?
 *
 * Retourne :
 *   - competences[] : liste des compétences (colonnes)
 *   - collaborateurs[] : liste avec leurs niveaux par compétenceId (lignes)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const departement = searchParams.get("departement")?.trim();
    const type        = searchParams.get("type");
    const categorie   = searchParams.get("categorie")?.trim();

    // Compétences actives (colonnes)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const compWhere: any = { actif: true };
    if (type)      compWhere.type      = type;
    if (categorie) compWhere.categorie = { contains: categorie, mode: "insensitive" };

    const competences = await prisma.competence.findMany({
      where:   compWhere,
      orderBy: [{ type: "asc" }, { categorie: "asc" }, { nom: "asc" }],
      select:  { id: true, nom: true, type: true, categorie: true },
    });

    // Collaborateurs (lignes)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profilWhere: any = { statut: { not: "INACTIF" } };
    if (departement) profilWhere.departement = { contains: departement, mode: "insensitive" };

    const profils = await prisma.profilRH.findMany({
      where:  profilWhere,
      select: {
        id: true, matricule: true, departement: true, fonction: true,
        gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
        competences: {
          where:  { actif: true },
          select: { competenceId: true, niveau: true, dateAcquisition: true, notes: true },
        },
      },
      orderBy: [{ departement: "asc" }, { gestionnaire: { member: { nom: "asc" } } }],
    });

    // Transformer en map competenceId → niveau pour chaque profil
    const collaborateurs = profils.map((p) => {
      const niveaux = Object.fromEntries(
        p.competences.map((c) => [c.competenceId, { niveau: c.niveau, dateAcquisition: c.dateAcquisition, notes: c.notes }])
      );
      return {
        profilRH: {
          id:          p.id,
          matricule:   p.matricule,
          nom:         p.gestionnaire.member.nom,
          prenom:      p.gestionnaire.member.prenom,
          departement: p.departement,
          fonction:    p.fonction,
        },
        niveaux, // { [competenceId]: { niveau, dateAcquisition, notes } }
      };
    });

    // Stats globales : nb collabs par niveau par compétence
    const statsParCompetence = await prisma.collaborateurCompetence.groupBy({
      by: ["competenceId", "niveau"],
      _count: { id: true },
      where: {
        actif: true,
        ...(competences.length > 0 && { competenceId: { in: competences.map((c) => c.id) } }),
      },
    });

    return NextResponse.json({ competences, collaborateurs, statsParCompetence });
  } catch (error) {
    console.error("GET /api/admin/rh/competences/matrice", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
