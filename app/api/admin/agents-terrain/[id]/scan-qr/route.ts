import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { getOrCreateScanToken, regenerateScanToken, scanUrl } from "@/lib/agentScan";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Vérifie que l'id (= User.id / memberId) est bien un agent terrain. */
async function verifierAgent(userId: number) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, nom: true, prenom: true, gestionnaire: { select: { role: true } } },
  });
  if (!u || u.gestionnaire?.role !== "AGENT_TERRAIN") return null;
  return { nom: u.nom, prenom: u.prenom };
}

async function payload(req: Request, token: string, agent: { nom: string; prenom: string }) {
  const url = scanUrl(req, token);
  const qr = await QRCode.toDataURL(url, { width: 320, margin: 1 });
  return { url, qr, agent };
}

/** GET — QR de tournée d'un agent (généré à la demande). Réservé admin. */
export async function GET(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const { id } = await params;
  const userId = Number(id);
  if (!userId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  const agent = await verifierAgent(userId);
  if (!agent) return NextResponse.json({ error: "Agent terrain introuvable" }, { status: 404 });
  const token = await getOrCreateScanToken(userId);
  return NextResponse.json({ data: await payload(req, token, agent) });
}

/** POST — régénère le QR de l'agent (invalide l'ancien). Réservé admin. */
export async function POST(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const { id } = await params;
  const userId = Number(id);
  if (!userId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  const agent = await verifierAgent(userId);
  if (!agent) return NextResponse.json({ error: "Agent terrain introuvable" }, { status: 404 });
  const token = await regenerateScanToken(userId);
  return NextResponse.json({ data: await payload(req, token, agent) });
}
