import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

/**
 * GET /api/admin/marketing/messages-internes — fil de discussion de l'équipe
 * marketing (CDC §21 "Messages internes"). 100 derniers messages, plus récent en dernier.
 */
export async function GET() {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "LECTURE");
  if (denied) return denied;

  const messages = await prisma.messageInterne.findMany({
    include: { auteur: { select: { id: true, nom: true, prenom: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ data: messages.reverse() });
}

/**
 * POST /api/admin/marketing/messages-internes
 * Body: { contenu }
 */
export async function POST(req: Request) {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "CREATION");
  if (denied) return denied;

  const { contenu } = await req.json();
  if (!contenu?.trim()) return NextResponse.json({ error: "contenu requis" }, { status: 400 });

  const message = await prisma.messageInterne.create({
    data: { contenu: contenu.trim(), auteurId: Number(session.user.id) },
    include: { auteur: { select: { id: true, nom: true, prenom: true } } },
  });
  return NextResponse.json({ data: message }, { status: 201 });
}
