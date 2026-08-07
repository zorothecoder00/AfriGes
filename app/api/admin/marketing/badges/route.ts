import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

const NIVEAUX = ["BRONZE", "ARGENT", "OR", "PLATINE"];

/**
 * Badges de gamification (CDC §37) — attribution automatique sur condition
 * simple : {type:"NIVEAU_FIDELITE",niveau} ou {type:"NB_ACHATS",seuil}.
 * GET  — catalogue + nb de clients badgés.
 * POST — crée un badge.
 */
export async function GET() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const badges = await prisma.badgeMarketing.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { attributions: true } } },
    });

    return NextResponse.json({ data: badges });
  } catch (e) {
    console.error("GET /api/admin/marketing/badges", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const body = await req.json();
    const { nom, description, icone, condition, actif } = body;

    if (!nom) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    if (!condition || typeof condition !== "object") return NextResponse.json({ error: "Condition requise" }, { status: 400 });
    if (condition.type === "NIVEAU_FIDELITE") {
      if (!NIVEAUX.includes(condition.niveau)) return NextResponse.json({ error: "Niveau de fidélité invalide" }, { status: 400 });
    } else if (condition.type === "NB_ACHATS") {
      if (!Number(condition.seuil) || Number(condition.seuil) <= 0) return NextResponse.json({ error: "Seuil d'achats invalide" }, { status: 400 });
    } else {
      return NextResponse.json({ error: "Type de condition invalide (NIVEAU_FIDELITE ou NB_ACHATS)" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const badge = await prisma.$transaction(async (tx) => {
      const b = await tx.badgeMarketing.create({
        data: { nom, description: description || null, icone: icone || null, condition, actif: actif === undefined ? true : Boolean(actif) },
      });
      await auditLog(tx, userId, "BADGE_CREE", "BadgeMarketing", b.id);
      return b;
    });

    return NextResponse.json({ data: badge }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/badges", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
