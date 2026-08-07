import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/marketing/challenges/[id]/classement — top participants (par progression). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { id } = await params;
    const challengeId = Number(id);
    if (isNaN(challengeId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const classement = await prisma.participationChallenge.findMany({
      where: { challengeId },
      orderBy: [{ progression: "desc" }],
      take: 100,
      include: { client: { select: { id: true, nom: true, prenom: true } } },
    });

    return NextResponse.json({ data: classement });
  } catch (e) {
    console.error("GET /api/admin/marketing/challenges/[id]/classement", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
