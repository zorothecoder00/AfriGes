import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/conges/calendrier
 * Toutes les absences approuvées qui chevauchent la période donnée.
 * Query: annee?, mois? (1-12)
 *
 * Retourne les demandes APPROUVE avec les infos collaborateur.
 * Utilisé pour le calendrier partagé.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const annee = Number(searchParams.get("annee") || new Date().getFullYear());
    const mois  = searchParams.get("mois") ? Number(searchParams.get("mois")) : null;

    // Période : tout le mois si mois fourni, tout l'année sinon
    const debut = mois ? new Date(annee, mois - 1, 1) : new Date(annee, 0, 1);
    const fin   = mois ? new Date(annee, mois, 0, 23, 59, 59) : new Date(annee, 11, 31, 23, 59, 59);

    const demandes = await prisma.demandeConge.findMany({
      where: {
        statut:    "APPROUVE",
        dateDebut: { lte: fin },
        dateFin:   { gte: debut },
      },
      include: {
        profilRH: {
          select: {
            id: true, matricule: true, departement: true, fonction: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        },
      },
      orderBy: { dateDebut: "asc" },
    });

    // Construire un index jour → liste de collaborateurs absents
    // (pour les clients du calendrier qui veulent voir par jour)
    const byDay: Record<string, { profilRHId: number; nom: string; prenom: string; type: string }[]> = {};

    for (const d of demandes) {
      const cur = new Date(d.dateDebut > debut ? d.dateDebut : debut);
      const end = new Date(d.dateFin   < fin   ? d.dateFin   : fin);
      while (cur <= end) {
        const key = cur.toISOString().slice(0, 10);
        if (!byDay[key]) byDay[key] = [];
        byDay[key].push({
          profilRHId: d.profilRHId,
          nom:    d.profilRH.gestionnaire.member.nom,
          prenom: d.profilRH.gestionnaire.member.prenom,
          type:   d.type,
        });
        cur.setDate(cur.getDate() + 1);
      }
    }

    return NextResponse.json({
      data:   demandes,
      byDay,
      periode: { annee, mois },
    });
  } catch (error) {
    console.error("GET /api/admin/rh/conges/calendrier", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
