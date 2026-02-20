import { NextResponse } from "next/server";
import { traiterExpirations } from "@/lib/expirationAuto";

/**
 * GET /api/cron/expirations
 *
 * Endpoint appelé quotidiennement (Vercel Cron ou service externe).
 * Protégé par la variable d'environnement CRON_SECRET.
 *
 * Exemples d'appel :
 * - Vercel Cron : configuré dans vercel.json
 * - Manuel : curl "https://monsite.com/api/cron/expirations?secret=MA_CLE"
 * - cron-job.org, easycron, etc.
 */
export async function GET(req: Request) {
  try {    
    // Vérification de la clé secrète
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret") || req.headers.get("authorization")?.replace("Bearer ", "");

    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || secret !== cronSecret) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const result = await traiterExpirations();

    return NextResponse.json({
      success: true,
      message: "Traitement des expirations termine",
      ...result,
    });
  } catch (error) {
    console.error("CRON /expirations error:", error);
    return NextResponse.json(
      { error: "Erreur lors du traitement des expirations" },
      { status: 500 }
    );
  }
}
