import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/me/preferences-notifications-rh
 * Retourne les préférences de notification RH de l'utilisateur connecté.
 * Renvoie les valeurs par défaut (tout activé) si aucune préférence n'existe.
 *
 * PUT /api/me/preferences-notifications-rh
 * Met à jour les préférences.
 * Body: { canalApp?, canalEmail?, finContrat?, validationConge?, evaluationProg?, formationAsuivre?, documentExpirant? }
 */

const DEFAULTS = {
  canalApp:         true,
  canalEmail:       false,
  finContrat:       true,
  validationConge:  true,
  evaluationProg:   true,
  formationAsuivre: true,
  documentExpirant: true,
};

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const userId = parseInt(session.user.id);
    const pref   = await prisma.preferenceNotificationRH.findUnique({ where: { userId } });

    return NextResponse.json({ data: pref ?? { ...DEFAULTS, userId } });
  } catch (error) {
    console.error("GET /api/me/preferences-notifications-rh", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const userId = parseInt(session.user.id);
    const body   = await req.json();

    const allowed: (keyof typeof DEFAULTS)[] = [
      "canalApp", "canalEmail",
      "finContrat", "validationConge", "evaluationProg", "formationAsuivre", "documentExpirant",
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    for (const key of allowed) {
      if (key in body) data[key] = Boolean(body[key]);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Aucun champ valide fourni" }, { status: 400 });
    }

    const pref = await prisma.preferenceNotificationRH.upsert({
      where:  { userId },
      update: data,
      create: { userId, ...DEFAULTS, ...data },
    });

    return NextResponse.json({ data: pref });
  } catch (error) {
    console.error("PUT /api/me/preferences-notifications-rh", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
