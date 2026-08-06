import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

/**
 * GET /api/admin/marketing/envois — journal marketing (CDC §76).
 * Filtres : campagneId, canalId, statut, clientId.
 */
export async function GET(req: NextRequest) {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "LECTURE");
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const campagneId = sp.get("campagneId");
  const canalId = sp.get("canalId");
  const statut = sp.get("statut");
  const clientId = sp.get("clientId");
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") || 100)));

  const envois = await prisma.envoiMessage.findMany({
    where: {
      ...(campagneId ? { campagneId: Number(campagneId) } : {}),
      ...(canalId ? { canalId: Number(canalId) } : {}),
      ...(statut ? { statut: statut as never } : {}),
      ...(clientId ? { clientId: Number(clientId) } : {}),
    },
    include: {
      campagne: { select: { id: true, code: true, nom: true } },
      canal: true,
      client: { select: { id: true, nom: true, prenom: true } },
      modeleMessage: { select: { id: true, nom: true } },
    },
    orderBy: { dateEnvoi: "desc" },
    take: limit,
  });

  return NextResponse.json({ data: envois });
}
