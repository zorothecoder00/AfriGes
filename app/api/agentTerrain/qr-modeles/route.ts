import { NextResponse } from "next/server";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { QR_MODELES, qrModeleUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";

/**
 * GET /api/agentTerrain/qr-modeles — QR « Modèle » des documents que l'agent peut créer (CDC §4.2).
 * Ces QR sont statiques (identiques pour tous les agents) et ne contiennent aucune donnée : scannés,
 * ils ouvrent le formulaire vierge après connexion.
 */
export async function GET(req: Request) {
  const session = await getAgentTerrainSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const data = await Promise.all(
    QR_MODELES.map(async (m) => {
      const url = qrModeleUrl(req, m.code);
      return { code: m.code, libelle: m.libelle, url, qr: await genererQrDataUrl(url) };
    })
  );
  return NextResponse.json({ data });
}
