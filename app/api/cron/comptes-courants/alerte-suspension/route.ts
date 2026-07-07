import { NextResponse } from "next/server";
import { alerterComptesAvantSuspension } from "@/lib/compteCourant";

/**
 * GET /api/cron/comptes-courants/alerte-suspension
 * Alerte préventive avant suspension pour inactivité (CDC §14) : notifie les comptes
 * ACTIF qui seront suspendus dans `joursAlerteAvantSuspension` jours faute d'opération.
 *
 * Cron Vercel (vercel.json) :
 *   { "path": "/api/cron/comptes-courants/alerte-suspension?secret=${CRON_SECRET}", "schedule": "45 3 * * *" }
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
    const r = await alerterComptesAvantSuspension();
    return NextResponse.json({
      success: true,
      message: `${r.alertes} alerte(s) « avant suspension » envoyée(s).`,
      ...r,
    });
  } catch (error) {
    console.error("CRON comptes-courants/alerte-suspension error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
