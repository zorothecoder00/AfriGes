import { NextResponse } from "next/server";
import { suspendreComptesInactifs } from "@/lib/compteCourant";

/**
 * GET /api/cron/comptes-courants/inactivite
 * Suspension automatique des comptes courants inactifs (CDC §4) : passe en
 * SUSPENDU tout compte ACTIF sans opération depuis `dureeInactiviteJours`.
 *
 * Cron Vercel (vercel.json) :
 *   { "path": "/api/cron/comptes-courants/inactivite?secret=${CRON_SECRET}", "schedule": "15 3 * * *" }
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
    const r = await suspendreComptesInactifs();
    return NextResponse.json({
      success: true,
      message: `${r.suspendus} compte(s) suspendu(s) pour inactivité sur ${r.verifies} concerné(s).`,
      ...r,
    });
  } catch (error) {
    console.error("CRON comptes-courants/inactivite error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
