import { NextResponse } from "next/server";
import { runAlertesStock } from "@/lib/alertesStock";

/**
 * GET /api/cron/appro-alertes
 * Alertes stock/péremption poussées automatiquement (CDC Approvisionnement §12).
 *
 * À appeler via un cron quotidien (ex: 07h30). Sécurité : ?secret=CRON_SECRET.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resultat = await runAlertesStock();
    return NextResponse.json({
      success: true,
      message: `${resultat.notifies} site(s) notifié(s) sur ${resultat.sites} avec anomalies · ${resultat.fournisseursEnRetard} fournisseur(s) en retard signalé(s).`,
      ...resultat,
    });
  } catch (error) {
    console.error("CRON appro-alertes error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
