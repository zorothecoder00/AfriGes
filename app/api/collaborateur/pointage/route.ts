import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getCollaborateurProfilRH } from "@/lib/authCollaborateur";
import { calculerPointage, getConfigHoraire } from "@/lib/calcPointage";
import { StatutPointage } from "@prisma/client";

/**
 * GET /api/collaborateur/pointage?limit=7
 * Historique des derniers pointages du collaborateur connecté.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const userId   = parseInt(session.user.id);
    const profilRH = await getCollaborateurProfilRH(userId);
    if (!profilRH) return NextResponse.json({ data: [] });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(31, Math.max(1, Number(searchParams.get("limit") || 7)));

    const pointages = await prisma.pointage.findMany({
      where:   { profilRHId: profilRH.id },
      orderBy: { date: "desc" },
      take:    limit,
      select: {
        id: true, date: true, heureArrivee: true, heureDepart: true,
        statut: true, source: true, tempsTotal: true, retardMinutes: true,
        heuresSup: true, valideParId: true, notes: true,
      },
    });

    return NextResponse.json({ data: pointages });
  } catch (error) {
    console.error("GET /api/collaborateur/pointage", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/collaborateur/pointage
 * Body: { action: "ARRIVEE" | "DEPART" }
 *
 * ARRIVEE : crée le pointage du jour avec heureArrivee = maintenant
 * DEPART  : met à jour le pointage du jour avec heureDepart = maintenant
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const userId   = parseInt(session.user.id);
    const profilRH = await getCollaborateurProfilRH(userId);
    if (!profilRH) {
      return NextResponse.json(
        { error: "Aucun dossier RH trouvé pour votre compte. Contactez le Responsable RH." },
        { status: 403 },
      );
    }

    const body   = await req.json();
    const action = body?.action as "ARRIVEE" | "DEPART" | undefined;
    if (action !== "ARRIVEE" && action !== "DEPART") {
      return NextResponse.json({ error: "action doit être ARRIVEE ou DEPART" }, { status: 400 });
    }

    const now       = new Date();
    const dateDebut = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateFin   = new Date(dateDebut); dateFin.setDate(dateFin.getDate() + 1);

    const existant = await prisma.pointage.findFirst({
      where: {
        profilRHId: profilRH.id,
        date: { gte: dateDebut, lt: dateFin },
      },
    });

    // Bloquer si le pointage du jour a été saisi manuellement par le RH
    if (existant && existant.source !== "SELF_SERVICE") {
      return NextResponse.json(
        { error: "Votre pointage d'aujourd'hui a déjà été saisi par le Responsable RH." },
        { status: 409 },
      );
    }

    const config = await getConfigHoraire(prisma, profilRH.id);

    if (action === "ARRIVEE") {
      if (existant) {
        return NextResponse.json(
          { error: "Vous avez déjà pointé votre arrivée aujourd'hui." },
          { status: 409 },
        );
      }

      const calcul = calculerPointage(now, null, config, dateDebut, "PRESENT");

      const pointage = await prisma.pointage.create({
        data: {
          profilRHId:    profilRH.id,
          date:          dateDebut,
          heureArrivee:  now,
          heureDepart:   null,
          statut:        calcul.statutAuto as StatutPointage,
          source:        "SELF_SERVICE",
          saisieParId:   userId,
          tempsTotal:    calcul.tempsTotal,
          retardMinutes: calcul.retardMinutes,
          heuresSup:     null,
        },
      });

      return NextResponse.json({ data: pointage }, { status: 201 });
    }

    // action === "DEPART"
    if (!existant) {
      return NextResponse.json(
        { error: "Vous n'avez pas encore pointé votre arrivée aujourd'hui." },
        { status: 409 },
      );
    }
    if (existant.heureDepart) {
      return NextResponse.json(
        { error: "Vous avez déjà pointé votre départ aujourd'hui." },
        { status: 409 },
      );
    }

    const calcul = calculerPointage(existant.heureArrivee, now, config, dateDebut, existant.statut);

    const updated = await prisma.pointage.update({
      where: { id: existant.id },
      data: {
        heureDepart:   now,
        statut:        calcul.statutAuto as StatutPointage,
        tempsTotal:    calcul.tempsTotal,
        retardMinutes: calcul.retardMinutes,
        heuresSup:     calcul.heuresSup,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("POST /api/collaborateur/pointage", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
