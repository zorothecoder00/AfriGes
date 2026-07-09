import { NextResponse } from "next/server";
import { libererBlocagesEchus } from "@/lib/compteCourant";

/**
 * GET /api/cron/comptes-courants/blocages
 * Libère les blocages volontaires d'épargne arrivés à échéance (CDC §19.E) :
 * passe les blocages ACTIF échus en LIBERE et notifie les admins.
 *
 * Cron Vercel (vercel.json) :
 *   { "path": "/api/cron/comptes-courants/blocages?secret=${CRON_SECRET}", "schedule": "0 5 * * *" }
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
    const r = await libererBlocagesEchus();
    return NextResponse.json({ success: true, message: `${r.liberes} blocage(s) libéré(s).`, ...r });
  } catch (error) {
    console.error("CRON comptes-courants/blocages error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
