import { NextResponse } from "next/server";
import { traiterEcheancesEpargne } from "@/lib/epargneProgrammee";

/**
 * GET /api/cron/comptes-courants/epargne
 * Traitement automatique des plans d'épargne programmée (CDC §19.B) : passe en
 * EXPIRE (ou ATTEINT si l'objectif est couvert) les plans EN_COURS dont
 * l'échéance est dépassée, et notifie les admins des plans échus non atteints.
 *
 * Cron Vercel (vercel.json) :
 *   { "path": "/api/cron/comptes-courants/epargne?secret=${CRON_SECRET}", "schedule": "30 3 * * *" }
 *
 * Sécurité : ?secret=CRON_SECRET (ou ne pas définir CRON_SECRET pour désactiver).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const r = await traiterEcheancesEpargne();
    return NextResponse.json({
      success: true,
      message: `${r.expires} plan(s) expiré(s) sur ${r.verifies} échéance(s) traitée(s).`,
      ...r,
    });
  } catch (error) {
    console.error("CRON comptes-courants/epargne error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
