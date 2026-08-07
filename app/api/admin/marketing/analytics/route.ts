import { NextRequest, NextResponse } from "next/server";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { rapportAttribution, topClientsCLV, tauxRetention, recommandationsMarketing, rapportParCanal, rapportProduitsMarketing, produitsComplementaires, produitsSaisonniers } from "@/lib/analyticsMarketing";
import { MODELES_ATTRIBUTION, type ModeleAttribution } from "@/lib/attributionModeles";

/**
 * GET /api/admin/marketing/analytics
 * Analytics marketing (CDC §7, §57, §59-61) : attribution (modèle
 * paramétrable), CLV, rétention, recommandations, canaux, produits.
 * Query: debut, fin (défaut : mois en cours), modele (CAMPAIGN_BASED défaut).
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
    const modeleParam = sp.get("modele");
    const modele: ModeleAttribution = modeleParam && MODELES_ATTRIBUTION.includes(modeleParam as ModeleAttribution) ? (modeleParam as ModeleAttribution) : "CAMPAIGN_BASED";

    const [attribution, clv, retention, recommandations, parCanal, produits, complementaires, saisonniers] = await Promise.all([
      rapportAttribution(debut, fin, modele),
      topClientsCLV(20),
      tauxRetention(debut, fin),
      recommandationsMarketing(),
      rapportParCanal(debut, fin),
      rapportProduitsMarketing(debut, fin, 20),
      produitsComplementaires(15),
      produitsSaisonniers(15),
    ]);

    return NextResponse.json({ data: { attribution, clv, retention, ...recommandations, parCanal, produits, complementaires, saisonniers, modele } });
  } catch (e) {
    console.error("GET /api/admin/marketing/analytics", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
