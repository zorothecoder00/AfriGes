import { NextRequest, NextResponse } from "next/server";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { rapportAttribution, topClientsCLV, tauxRetention, recommandationsMarketing } from "@/lib/analyticsMarketing";

/**
 * GET /api/admin/marketing/analytics
 * Analytics marketing (CDC §7, Phase 7) : attribution, CLV, rétention,
 * recommandations. Query: debut, fin (défaut : mois en cours).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const sp = req.nextUrl.searchParams;
    const debut = sp.get("debut") ? new Date(sp.get("debut")!) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const fin = sp.get("fin") ? new Date(sp.get("fin")!) : new Date();

    const [attribution, clv, retention, recommandations] = await Promise.all([
      rapportAttribution(debut, fin),
      topClientsCLV(20),
      tauxRetention(debut, fin),
      recommandationsMarketing(),
    ]);

    return NextResponse.json({ data: { attribution, clv, retention, ...recommandations } });
  } catch (e) {
    console.error("GET /api/admin/marketing/analytics", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
