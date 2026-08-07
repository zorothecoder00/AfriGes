import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluerAlertesMarketing } from "@/lib/alertesMarketing";
import { notifyRoles } from "@/lib/notifications";

const TITRE_PAR_TYPE: Record<string, string> = {
  BUDGET_DEPASSE: "Budget dépassé",
  ROI_FAIBLE: "ROI sous l'objectif",
  ROI_DEPASSE_OBJECTIF: "ROI au-dessus de l'objectif",
  AUDIENCE_TROP_PETITE: "Audience trop petite",
  PRODUIT_RUPTURE: "Produit en rupture",
  FREQUENCE_EXCESSIVE: "Fréquence de communication excessive",
};

/**
 * GET /api/cron/marketing/alertes
 * Évalue les 6 alertes marketing (CDC §77) sur les campagnes ACTIVE et
 * notifie l'équipe marketing (Responsable/Directeur Marketing + Admin).
 *
 * Sécurité : passer ?secret=CRON_SECRET (voir vercel.json).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const alertes = await evaluerAlertesMarketing();

    await prisma.$transaction(async (tx) => {
      for (const a of alertes) {
        await notifyRoles(tx, ["RESPONSABLE_MARKETING", "DIRECTEUR_MARKETING"], {
          titre: `${TITRE_PAR_TYPE[a.type] ?? a.type} — ${a.campagneNom}`,
          message: a.message,
          priorite: a.priorite,
          actionUrl: `/dashboard/admin/marketing/campagnes/${a.campagneId}`,
        });
      }
    });

    return NextResponse.json({ success: true, alertes: alertes.length });
  } catch (error) {
    console.error("CRON marketing/alertes error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
