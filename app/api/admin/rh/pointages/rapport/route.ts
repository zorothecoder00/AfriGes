import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/pointages/rapport
 * Rapport mensuel de présence par collaborateur.
 * Query: mois (1-12), annee, profilRHId? (filtre optionnel), departement?
 *
 * Retourne pour chaque collaborateur :
 *  - joursPresents, joursAbsents, joursConge, joursMission, joursFeries, demiJournees
 *  - totalRetardMinutes, totalHeuresSup, totalTravailMinutes
 *  - pointages[]  (détail jour par jour)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const mois        = Number(searchParams.get("mois")  || new Date().getMonth() + 1);
    const annee       = Number(searchParams.get("annee") || new Date().getFullYear());
    const profilRHId  = searchParams.get("profilRHId");
    const departement = searchParams.get("departement")?.trim();

    const debut = new Date(annee, mois - 1, 1);
    const fin   = new Date(annee, mois, 1);

    // Récupérer tous les profils concernés
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profilWhere: any = { statut: { not: "INACTIF" } };
    if (profilRHId)  profilWhere.id          = Number(profilRHId);
    if (departement) profilWhere.departement  = { contains: departement, mode: "insensitive" };

    const profils = await prisma.profilRH.findMany({
      where:   profilWhere,
      select: {
        id: true, matricule: true, fonction: true, departement: true,
        gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
        pointages: {
          where:   { date: { gte: debut, lt: fin } },
          orderBy: { date: "asc" },
          select: {
            id: true, date: true, statut: true,
            heureArrivee: true, heureDepart: true,
            tempsTotal: true, retardMinutes: true, heuresSup: true,
            justificatif: true, notes: true,
            valideParId: true, valideA: true,
          },
        },
      },
      orderBy: [{ departement: "asc" }, { gestionnaire: { member: { nom: "asc" } } }],
    });

    // Nombre de jours ouvrés dans le mois (lundi–vendredi)
    let joursOuvresMois = 0;
    for (let d = new Date(debut); d < fin; d.setDate(d.getDate() + 1)) {
      const j = d.getDay();
      if (j !== 0 && j !== 6) joursOuvresMois++;
    }

    // Agréger par collaborateur
    const rapport = profils.map((p) => {
      const pts = p.pointages;
      const agg = {
        joursPresents:       pts.filter((x) => x.statut === "PRESENT").length,
        joursRetard:         pts.filter((x) => x.statut === "RETARD").length,
        joursAbsents:        pts.filter((x) => x.statut === "ABSENT").length,
        joursConge:          pts.filter((x) => x.statut === "CONGE").length,
        joursMission:        pts.filter((x) => x.statut === "MISSION").length,
        joursFeries:         pts.filter((x) => x.statut === "FERIE").length,
        demiJournees:        pts.filter((x) => x.statut === "DEMI_JOURNEE").length,
        totalRetardMinutes:  pts.reduce((s, x) => s + (x.retardMinutes ?? 0), 0),
        totalHeuresSup:      pts.reduce((s, x) => s + (x.heuresSup     ?? 0), 0),
        totalTravailMinutes: pts.reduce((s, x) => s + (x.tempsTotal    ?? 0), 0),
        tauxPresence:        joursOuvresMois > 0
          ? Math.round(((pts.filter((x) => ["PRESENT","RETARD","DEMI_JOURNEE"].includes(x.statut)).length) / joursOuvresMois) * 100)
          : null,
      };

      return {
        profilRH: {
          id:          p.id,
          matricule:   p.matricule,
          fonction:    p.fonction,
          departement: p.departement,
          nom:         p.gestionnaire.member.nom,
          prenom:      p.gestionnaire.member.prenom,
        },
        ...agg,
        pointages: pts,
      };
    });

    // Totaux globaux
    const totaux = {
      joursOuvresMois,
      totalCollaborateurs:    rapport.length,
      moyenneTauxPresence:    rapport.length > 0
        ? Math.round(rapport.reduce((s, r) => s + (r.tauxPresence ?? 0), 0) / rapport.length)
        : 0,
      totalRetardMinutes:     rapport.reduce((s, r) => s + r.totalRetardMinutes, 0),
      totalHeuresSup:         rapport.reduce((s, r) => s + r.totalHeuresSup, 0),
    };

    return NextResponse.json({ data: rapport, totaux, periode: { mois, annee } });
  } catch (error) {
    console.error("GET /api/admin/rh/pointages/rapport", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
