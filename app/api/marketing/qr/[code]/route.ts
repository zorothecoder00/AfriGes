import { NextResponse } from "next/server";
import { resoudreEtIncrementerScan } from "@/lib/qrMarketing";

type Ctx = { params: Promise<{ code: string }> };

/**
 * GET /api/marketing/qr/[code] — public, sans auth.
 * URL encodée dans le QR physique (CDC §43) : compte le scan puis redirige
 * vers la landing page associée (ou l'URL de secours).
 */
export async function GET(req: Request, { params }: Ctx) {
  const { code } = await params;
  const resolved = await resoudreEtIncrementerScan(code).catch(() => null);
  const base = new URL(req.url).origin;
  if (!resolved) return NextResponse.redirect(`${base}/catalogue`);
  const url = resolved.url.startsWith("http") ? resolved.url : `${base}${resolved.url}`;
  return NextResponse.redirect(url);
}
