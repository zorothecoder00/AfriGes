import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { regenerateScanToken, scanUrl } from "@/lib/agentScan";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/admin/agents-terrain/scan-qr  (admin only)
 * QR de tournée de TOUS les agents terrain actifs — pour une planche imprimable.
 * Route statique « scan-qr » : prioritaire sur [id], pas de conflit.
 */
export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const agents = await prisma.user.findMany({
    where: { gestionnaire: { role: "AGENT_TERRAIN", actif: true } },
    select: { id: true, nom: true, prenom: true, scanTokenTournee: true },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });

  const data: { id: number; nom: string; prenom: string; url: string; qr: string }[] = [];
  for (const a of agents) {
    const token = a.scanTokenTournee ?? (await regenerateScanToken(a.id));
    const url = scanUrl(req, token);
    const qr = await QRCode.toDataURL(url, { width: 240, margin: 1 });
    data.push({ id: a.id, nom: a.nom, prenom: a.prenom, url, qr });
  }

  return NextResponse.json({ data });
}
