import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { echangerRecompense } from "@/lib/recompensesFidelite";
import { getFidelite } from "@/lib/fidelite";

const MESSAGES: Record<string, string> = {
  RECOMPENSE_INTROUVABLE: "Récompense introuvable",
  RECOMPENSE_INACTIVE: "Cette récompense n'est plus disponible",
  RECOMPENSE_EXPIREE: "Cette récompense a expiré",
  POINTS_INSUFFISANTS: "Solde de points insuffisant pour ce client",
};

/** GET /api/admin/marketing/recompenses/echanger?clientId= — solde de points du client (avant échange). */
export async function GET(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const clientId = Number(new URL(req.url).searchParams.get("clientId"));
    if (!clientId) return NextResponse.json({ error: "clientId requis" }, { status: 400 });

    const fidelite = await getFidelite(clientId);
    return NextResponse.json({ data: fidelite });
  } catch (e) {
    console.error("GET /api/admin/marketing/recompenses/echanger", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/marketing/recompenses/echanger
 * Échange une récompense du catalogue contre des points d'un client (CDC §36).
 * Déclenché côté staff (marketing/agence) sur la fiche d'un client.
 * Body: { clientId, recompenseId }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const body = await req.json();
    const clientId = Number(body.clientId);
    const recompenseId = Number(body.recompenseId);
    if (!clientId || !recompenseId) {
      return NextResponse.json({ error: "clientId et recompenseId sont requis" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    try {
      const echange = await prisma.$transaction((tx) =>
        echangerRecompense(tx, { clientId, recompenseId, creeParId: userId }),
      );
      return NextResponse.json({ data: { ...echange, pointsUtilises: echange.pointsUtilises } }, { status: 201 });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (MESSAGES[code]) return NextResponse.json({ error: MESSAGES[code] }, { status: 400 });
      throw e;
    }
  } catch (e) {
    console.error("POST /api/admin/marketing/recompenses/echanger", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
