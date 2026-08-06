import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/marketing/regles/[id] — détail + étapes. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { id } = await params;
    const regleId = Number(id);
    if (isNaN(regleId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const regle = await prisma.regleAutomatisation.findUnique({
      where: { id: regleId },
      include: {
        etapes: { orderBy: { ordre: "asc" } },
        creePar: { select: { id: true, nom: true, prenom: true } },
        _count: { select: { executions: true } },
      },
    });
    if (!regle) return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });

    return NextResponse.json({ data: regle });
  } catch (e) {
    console.error("GET /api/admin/marketing/regles/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/marketing/regles/[id]
 * Édition (nom/description/actif/declencheur/declencheurParams). Si `etapes`
 * est fourni, remplace intégralement la liste d'étapes (le constructeur "sans
 * code" envoie toujours la liste complète après réordonnancement).
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const regleId = Number(id);
    if (isNaN(regleId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { nom, description, actif, declencheur, declencheurParams, etapes } = body;
    const userId = Number(session.user.id);

    const regle = await prisma.$transaction(async (tx) => {
      if (Array.isArray(etapes)) {
        await tx.etapeAutomatisation.deleteMany({ where: { regleId } });
      }
      const updated = await tx.regleAutomatisation.update({
        where: { id: regleId },
        data: {
          ...(nom !== undefined ? { nom } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
          ...(actif !== undefined ? { actif } : {}),
          ...(declencheur !== undefined ? { declencheur } : {}),
          ...(declencheurParams !== undefined ? { declencheurParams } : {}),
          ...(Array.isArray(etapes)
            ? {
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
              }
            : {}),
        },
        include: { etapes: { orderBy: { ordre: "asc" } } },
      });
      await auditLog(tx, userId, "UPDATE", "RegleAutomatisation", regleId, { nom, actif });
      return updated;
    });

    return NextResponse.json({ data: regle });
  } catch (e) {
    console.error("PATCH /api/admin/marketing/regles/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** DELETE /api/admin/marketing/regles/[id] — refusé si des exécutions sont EN_COURS. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "SUPPRESSION_LOGIQUE");
    if (denied) return denied;

    const { id } = await params;
    const regleId = Number(id);
    if (isNaN(regleId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const enCours = await prisma.executionAutomatisation.count({ where: { regleId, statut: "EN_COURS" } });
    if (enCours > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer : ${enCours} client(s) en cours dans cette séquence. Désactivez-la plutôt.` },
        { status: 400 }
      );
    }

    const userId = Number(session.user.id);
    await prisma.$transaction(async (tx) => {
      await tx.regleAutomatisation.delete({ where: { id: regleId } });
      await auditLog(tx, userId, "DELETE", "RegleAutomatisation", regleId);
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/admin/marketing/regles/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
