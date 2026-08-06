import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

/**
 * GET /api/admin/marketing/regles
 * Liste des règles d'automatisation (CDC §16-18).
 */
export async function GET() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const regles = await prisma.regleAutomatisation.findMany({
      include: {
        etapes: { orderBy: { ordre: "asc" } },
        creePar: { select: { id: true, nom: true, prenom: true } },
        _count: { select: { executions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const enCoursParRegle = await prisma.executionAutomatisation.groupBy({
      by: ["regleId"],
      where: { statut: "EN_COURS" },
      _count: { _all: true },
    });
    const enCoursMap = new Map(enCoursParRegle.map((e) => [e.regleId, e._count._all]));

    return NextResponse.json({
      data: regles.map((r) => ({ ...r, nbEnCours: enCoursMap.get(r.id) ?? 0 })),
    });
  } catch (e) {
    console.error("GET /api/admin/marketing/regles", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/marketing/regles
 * Création d'une règle avec ses étapes (constructeur "sans code" à liste d'étapes).
 * Body: { nom, description?, actif?, declencheur, declencheurParams?,
 *   etapes: { delaiJours, action, actionParams, arreterSiAchatEntreTemps? }[] }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const body = await req.json();
    const { nom, description, actif, declencheur, declencheurParams, etapes } = body;

    if (!nom || !declencheur || !Array.isArray(etapes) || etapes.length === 0) {
      return NextResponse.json(
        { error: "Champs requis manquants (nom, declencheur, au moins une étape)" },
        { status: 400 }
      );
    }

    const userId = Number(session.user.id);

    const regle = await prisma.$transaction(async (tx) => {
      const created = await tx.regleAutomatisation.create({
        data: {
          nom,
          description: description || null,
          actif: actif ?? true,
          declencheur,
          declencheurParams: declencheurParams ?? undefined,
          creeParId: userId,
          etapes: {
            create: (etapes as { delaiJours: number; action: string; actionParams: unknown; arreterSiAchatEntreTemps?: boolean }[]).map(
              (e, i) => ({
                ordre: i + 1,
                delaiJours: Number(e.delaiJours ?? 0),
                action: e.action as never,
                actionParams: e.actionParams ?? {},
                arreterSiAchatEntreTemps: !!e.arreterSiAchatEntreTemps,
              })
            ),
          },
        },
        include: { etapes: { orderBy: { ordre: "asc" } } },
      });
      await auditLog(tx, userId, "CREATE", "RegleAutomatisation", created.id, { nom, declencheur });
      return created;
    });

    return NextResponse.json({ data: regle }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/regles", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
