import { NextResponse } from "next/server";

/**
 * @deprecated Flow B (VenteDirecte CREDIT_REQUEST) supprimé.
 * Utiliser GET /api/magasinier/credits pour les livraisons de crédits (Flow A).
 */
export async function GET() {
  return NextResponse.json(
    { error: "Ce endpoint est obsolète. Utiliser /api/magasinier/credits." },
    { status: 410 }
  );
}
