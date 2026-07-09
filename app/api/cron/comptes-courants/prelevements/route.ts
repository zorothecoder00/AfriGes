import { NextResponse } from "next/server";
import { executerPrelevementsAuto } from "@/lib/prelevementAuto";

/**
 * GET /api/cron/comptes-courants/prelevements
 * Prélèvement automatique des échéances de crédit (CDC §19.C) : pour chaque
 * autorisation active, débite le compte courant du montant dû (arriéré + échéance
 * du jour), dans la limite du plafond et en préservant le solde plancher.
 *
 * Cron Vercel (vercel.json) :
 *   { "path": "/api/cron/comptes-courants/prelevements?secret=${CRON_SECRET}", "schedule": "0 4 * * *" }
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
    const r = await executerPrelevementsAuto();
    return NextResponse.json({
      success: true,
      message: `${r.executes} prélèvement(s) exécuté(s) pour ${r.totalPreleve.toLocaleString("fr-FR")} FCFA sur ${r.verifies} autorisation(s).`,
      ...r,
    });
  } catch (error) {
    console.error("CRON comptes-courants/prelevements error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
