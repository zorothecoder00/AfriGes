import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { recalculerAudience, figerAudienceStatique, type RegleAudience } from "@/lib/audienceMarketing";

/**
 * GET /api/admin/marketing/audiences — liste des audiences (CDC §10-15).
 */
export async function GET() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const audiences = await prisma.audienceMarketing.findMany({
      include: {
        creePar: { select: { id: true, nom: true, prenom: true } },
        regles: true,
        _count: { select: { campagnes: true, membres: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: audiences });
  } catch (e) {
    console.error("GET /api/admin/marketing/audiences", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/marketing/audiences
 * Body: { nom, description?, type: "STATIQUE"|"DYNAMIQUE", regles: RegleAudience[] }
 * Crée l'audience puis calcule immédiatement ses membres (figés si STATIQUE,
 * recalculables ensuite si DYNAMIQUE — CDC §12-13).
 */
export async function POST(req: Request) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const body = await req.json();
    const { nom, description, type, regles } = body as {
      nom?: string; description?: string; type?: "STATIQUE" | "DYNAMIQUE"; regles?: RegleAudience[];
    };
    if (!nom || !regles?.length) {
      return NextResponse.json({ error: "nom et au moins une règle sont requis" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const audience = await prisma.audienceMarketing.create({
      data: {
        nom,
        description: description || null,
        type: type ?? "DYNAMIQUE",
        creeParId: userId,
        regles: { create: regles.map((r) => ({ champ: r.champ, operateur: r.operateur, valeur: r.valeur })) },
      },
      include: { regles: true },
    });

    const { taille } = type === "STATIQUE"
      ? await figerAudienceStatique(audience.id, regles)
      : await recalculerAudience(audience.id);

    return NextResponse.json({ data: { ...audience, tailleCalculee: taille } }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/audiences", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
