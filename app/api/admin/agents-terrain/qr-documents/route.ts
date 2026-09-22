import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { QR_MODELES, qrModeleUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/admin/agents-terrain/qr-documents?code=BCC  (admin only)
 * Planche imprimable du QR « Modèle » (ex. Bon de commande client) — une carte par
 * agent terrain actif, avec son nom + son identifiant de connexion (email), pour que
 * l'admin puisse la distribuer physiquement. Le QR image est identique pour tous les
 * agents (QR_MODELES ne porte aucune donnée) ; scanné, il ouvre le formulaire vierge
 * après connexion de l'agent (voir app/m/[code]/page.tsx).
 */
export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") ?? "BCC").toUpperCase();
  const modele = QR_MODELES.find((m) => m.code === code);
  if (!modele) return NextResponse.json({ error: "Type de document inconnu" }, { status: 400 });

  const url = qrModeleUrl(req, modele.code);
  const qr = await genererQrDataUrl(url);

  const agents = await prisma.user.findMany({
    where: { gestionnaire: { role: "AGENT_TERRAIN", actif: true } },
    select: { id: true, nom: true, prenom: true, email: true },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });

  return NextResponse.json({
    modeles: QR_MODELES.map((m) => ({ code: m.code, libelle: m.libelle })),
    modele: { code: modele.code, libelle: modele.libelle },
    url,
    qr,
    agents,
  });
}
