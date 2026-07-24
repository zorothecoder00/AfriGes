import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession, profilRHIdsPerimetre } from "@/lib/authRH";

/**
 * GET /api/responsableRH/conges/calendrier — Calendrier partagé des absences
 * approuvées, scopé au périmètre PDV. Même comportement que
 * /api/admin/rh/conges/calendrier (cf. ce fichier pour le détail).
 *   Query: annee?, mois? (1-12) — période = le mois si fourni, l'année entière sinon.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const annee = Number(searchParams.get("annee") || new Date().getFullYear());
    const mois  = searchParams.get("mois") ? Number(searchParams.get("mois")) : null;

    const debut = mois ? new Date(annee, mois - 1, 1) : new Date(annee, 0, 1);
    const fin   = mois ? new Date(annee, mois, 0, 23, 59, 59) : new Date(annee, 11, 31, 23, 59, 59);

    const profilRHIds = await profilRHIdsPerimetre(session);

    const demandes = await prisma.demandeConge.findMany({
      where: {
        statut:    "APPROUVE",
        dateDebut: { lte: fin },
        dateFin:   { gte: debut },
        ...(profilRHIds ? { profilRHId: { in: profilRHIds } } : {}),
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
    console.error("GET /api/responsableRH/conges/calendrier", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
