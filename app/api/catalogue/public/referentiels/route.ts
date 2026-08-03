import { NextResponse } from "next/server";
import { getReferentielsPublics } from "@/lib/catalogueReferentielsPublics";

/**
 * Référentiels publics pour filtrer la vitrine / borne (familles, catégories,
 * marques actives). Léger, sans données confidentielles, sans authentification.
 */
export async function GET() {
  try {
    const refs = await getReferentielsPublics();
    return NextResponse.json(refs);
  } catch (error) {
    console.error("GET /api/catalogue/public/referentiels", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
