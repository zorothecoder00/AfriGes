import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getCollaborateurProfilRH } from "@/lib/authCollaborateur";

/**
 * GET /api/collaborateur/pointage/today
 * Retourne le pointage du jour + infos ProfilRH du collaborateur connecté.
 * Retourne { profilRH: null } si l'utilisateur n'a pas de ProfilRH.
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const userId  = parseInt(session.user.id);
    const profilRH = await getCollaborateurProfilRH(userId);

    if (!profilRH) {
      return NextResponse.json({ profilRH: null, pointage: null });
    }

    const today     = new Date();
    const dateDebut = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dateFin   = new Date(dateDebut); dateFin.setDate(dateFin.getDate() + 1);

    const pointage = await prisma.pointage.findFirst({
      where: {
        profilRHId: profilRH.id,
        date: { gte: dateDebut, lt: dateFin },
      },
      include: {
        profilRH: {
          select: {
            configHoraire: {
              select: { heureArrivee: true, heureDepart: true },
            },
          },
        },
      },
    });

    // Config horaire (personnelle ou défaut) pour afficher les horaires théoriques
    let configHoraire = pointage?.profilRH?.configHoraire ?? null;
    if (!configHoraire) {
      const defaut = await prisma.configHoraire.findFirst({
        where:  { estDefaut: true },
        select: { heureArrivee: true, heureDepart: true },
      });
      configHoraire = defaut;
    }

    return NextResponse.json({
      profilRH: { id: profilRH.id, matricule: profilRH.matricule },
      pointage: pointage
        ? {
            id:            pointage.id,
            date:          pointage.date,
            heureArrivee:  pointage.heureArrivee,
            heureDepart:   pointage.heureDepart,
            statut:        pointage.statut,
            source:        pointage.source,
            tempsTotal:    pointage.tempsTotal,
            retardMinutes: pointage.retardMinutes,
            heuresSup:     pointage.heuresSup,
            valideParId:   pointage.valideParId,
            notes:         pointage.notes,
          }
        : null,
      configHoraire,
    });
  } catch (error) {
    console.error("GET /api/collaborateur/pointage/today", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
