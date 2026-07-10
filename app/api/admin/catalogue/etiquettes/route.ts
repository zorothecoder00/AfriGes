import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { code128Svg } from "@/lib/barcode";

export const runtime = "nodejs";

/**
 * Étiquettes produit (Catalogue §13) — admin.
 * GET ?ids=1,2,3 — renvoie, pour chaque produit, ses données d'étiquette avec
 * le code-barres (Code 128 SVG) et le QR code (SVG) déjà rendus. La page
 * d'impression n'a plus qu'à disposer les étiquettes et lancer l'impression.
 */
export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const ids = (searchParams.get("ids") || "")
    .split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return NextResponse.json({ message: "Aucun produit sélectionné" }, { status: 400 });

  const produits = await prisma.produit.findMany({
    where: { id: { in: ids.slice(0, 200) } },
    select: {
      id: true, nom: true, nomCommercial: true, codeProduit: true, codeBarre: true, qrCode: true,
      prixUnitaire: true, marque: { select: { nom: true } },
    },
  });

  const data = await Promise.all(produits.map(async (p) => {
    const barcodeValue = p.codeBarre || p.codeProduit || `PRD-${p.id}`;
    const qrContent = p.qrCode || p.codeProduit || p.codeBarre || p.nom;
    const [qrSvg] = await Promise.all([
      QRCode.toString(qrContent, { type: "svg", margin: 1, width: 120 }),
    ]);
    return {
      id: p.id,
      nom: p.nomCommercial || p.nom,
      codeProduit: p.codeProduit,
      codeBarre: barcodeValue,
      prixUnitaire: Number(p.prixUnitaire),
      marque: p.marque?.nom ?? null,
      barcodeSvg: code128Svg(barcodeValue, { moduleWidth: 2, height: 50, showText: true }),
      qrSvg,
    };
  }));

  // Conserver l'ordre demandé.
  const byId = new Map(data.map((d) => [d.id, d]));
  return NextResponse.json({ data: ids.map((id) => byId.get(id)).filter(Boolean) });
}
