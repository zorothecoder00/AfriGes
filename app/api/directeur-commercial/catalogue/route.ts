import { NextResponse } from "next/server";
import { getDirecteurCommercialSession } from "@/lib/authDirecteurCommercial";
import { projeterCatalogue } from "@/lib/catalogueProjection";

/**
 * GET /api/directeur-commercial/catalogue
 * Catalogue commercial complet, cross-agence (Catalogue §21.B) : prix de
 * vente, prix crédit, promotions, disponibilité, marges, historique — sans
 * paramètres système ni comptabilité. Réutilise le même moteur de projection
 * que la vitrine publique (`projeterCatalogue`), avec la vue DIRECTEUR_COMMERCIAL
 * et sans restriction d'agence (vue globale).
 * Query : search, familleId, categorieId, marqueId, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getDirecteurCommercialSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const numOrNull = (key: string) => (searchParams.get(key) ? Number(searchParams.get(key)) : null);

    const result = await projeterCatalogue({
      cle: "DIRECTEUR_COMMERCIAL",
      search: searchParams.get("search"),
      familleId: numOrNull("familleId"),
      categorieId: numOrNull("categorieId"),
      marqueId: numOrNull("marqueId"),
      page: Number(searchParams.get("page") || 1),
      limit: Number(searchParams.get("limit") || 24),
    });
    if (!result) return NextResponse.json({ error: "Vue introuvable" }, { status: 500 });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/directeur-commercial/catalogue", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
