import { NextResponse } from "next/server";
import { projeterCatalogue } from "@/lib/catalogueProjection";

/**
 * Catalogue public (Catalogue §21-24) — surface VITRINE / BORNE, sans authentification.
 * Projette le catalogue réel via `projeterCatalogue` (même moteur que l'aperçu admin
 * et les futures surfaces mobile → synchro §24). Seules les vues PUBLIQUES sont
 * autorisées ici : `VISITEUR` (vitrine web) et `CLIENT` (borne en magasin), qui
 * n'exposent aucun champ confidentiel et masquent la quantité exacte (mode PALIER).
 *
 * Query : vue (VISITEUR|CLIENT), search, familleId, categorieId, marqueId, pdvId, page, limit
 */
const VUES_PUBLIQUES = new Set(["VISITEUR", "CLIENT"]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const vueDemandee = (searchParams.get("vue") || "VISITEUR").toUpperCase();
    const cle = VUES_PUBLIQUES.has(vueDemandee) ? vueDemandee : "VISITEUR";

    const num = (k: string) => {
      const v = searchParams.get(k);
      return v && !Number.isNaN(Number(v)) ? Number(v) : null;
    };

    const result = await projeterCatalogue({
      cle,
      search:         searchParams.get("search"),
      familleId:      num("familleId"),
      categorieId:    num("categorieId"),
      marqueId:       num("marqueId"),
      pointDeVenteId: num("pdvId"),
      page:           num("page") ?? 1,
      limit:          num("limit") ?? 24,
    });

    if (!result) return NextResponse.json({ error: "Vue indisponible" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/catalogue/public", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
