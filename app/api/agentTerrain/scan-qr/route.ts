import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { getOrCreateScanToken, regenerateScanToken } from "@/lib/agentScan";

export const runtime = "nodejs";

async function qrPayload(req: Request, token: string) {
  const url = `${new URL(req.url).origin}/scan/${token}`;
  const qr = await QRCode.toDataURL(url, { width: 320, margin: 1 });
  return { url, qr };
}

/** GET — jeton + QR de l'agent connecté (généré à la première demande). */
export async function GET(req: Request) {
  const session = await getAgentTerrainSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const token = await getOrCreateScanToken(Number(session.user.id));
  return NextResponse.json({ data: await qrPayload(req, token) });
}

/** POST — régénère le jeton (invalide l'ancien QR). */
export async function POST(req: Request) {
  const session = await getAgentTerrainSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const token = await regenerateScanToken(Number(session.user.id));
  return NextResponse.json({ data: await qrPayload(req, token) });
}
