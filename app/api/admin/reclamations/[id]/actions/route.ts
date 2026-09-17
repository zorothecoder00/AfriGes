import { NextResponse } from "next/server";
import { TypeActionReclamation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getReclamationSession } from "@/lib/authReclamation";
import { resolvePdvIdsAutorises, rolesANotifierAction, LABEL_TYPE_ACTION_RECLAMATION } from "@/lib/reclamationClient";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * "Fiche de traitement de réclamation" (CDC §5.8) — journal d'actions libre
 * (note interne, décision, investigation…), en complément des transitions de
 * statut gérées directement par PATCH /api/admin/reclamations/[id].
 */

type Ctx = { params: Promise<{ id: string }> };

async function reclamationAutorisee(id: number, pdvIds: number[] | null) {
  const r = await prisma.reclamationClient.findUnique({ where: { id }, select: { id: true, numero: true, statut: true, pointDeVenteId: true } });
  if (!r) return null;
  if (pdvIds !== null && (!r.pointDeVenteId || !pdvIds.includes(r.pointDeVenteId))) return "forbidden" as const;
  return r;
}

/** GET /api/admin/reclamations/[id]/actions — journal de traitement. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getReclamationSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const pdvIds = await resolvePdvIdsAutorises(session);
    const reclamation = await reclamationAutorisee(Number(id), pdvIds);
    if (reclamation === null) return NextResponse.json({ error: "Réclamation introuvable" }, { status: 404 });
    if (reclamation === "forbidden") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const actions = await prisma.actionReclamation.findMany({
      where: { reclamationId: reclamation.id },
      include: { auteur: { select: { id: true, nom: true, prenom: true } } },
      orderBy: { dateAction: "desc" },
    });
    return NextResponse.json({ data: actions });
  } catch (error) {
    console.error("GET /admin/reclamations/[id]/actions:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** POST /api/admin/reclamations/[id]/actions — Body: { type, description? } */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getReclamationSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const pdvIds = await resolvePdvIdsAutorises(session);
    const reclamation = await reclamationAutorisee(Number(id), pdvIds);
    if (reclamation === null) return NextResponse.json({ error: "Réclamation introuvable" }, { status: 404 });
    if (reclamation === "forbidden") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    if (reclamation.statut === "CLOTUREE") return NextResponse.json({ error: "Réclamation déjà clôturée" }, { status: 409 });

    const body = await req.json();
    const type = body.type as TypeActionReclamation;
    if (!Object.values(TypeActionReclamation).includes(type)) {
      return NextResponse.json({ error: "Type d'action invalide" }, { status: 400 });
    }
    // Les statuts REJETEE/CLOTUREE et l'action AVOIR_EMIS ont leurs propres endpoints dédiés
    if (["REJET", "CLOTURE", "AVOIR_EMIS"].includes(type)) {
      return NextResponse.json({ error: "Utiliser l'endpoint dédié pour ce type d'action" }, { status: 400 });
    }

    const userId = Number(session.user.id);

    const action = await prisma.$transaction(async (tx) => {
      const a = await tx.actionReclamation.create({
        data: { reclamationId: reclamation.id, type, description: body.description?.trim() || null, auteurId: userId },
        include: { auteur: { select: { id: true, nom: true, prenom: true } } },
      });
      await auditLog(tx, userId, `RECLAMATION_ACTION_${type}`, "ActionReclamation", a.id, undefined, getRequestMeta(req));

      const { roles, haute } = rolesANotifierAction(type);
      if (roles.length) {
        await notifyRoles(tx, roles, {
          titre: `${LABEL_TYPE_ACTION_RECLAMATION[type]} — réclamation ${reclamation.numero}`,
          message: `${session.user.prenom} ${session.user.nom} a enregistré "${LABEL_TYPE_ACTION_RECLAMATION[type]}".`,
          priorite: haute ? "HAUTE" : "NORMAL",
          actionUrl: `/dashboard/admin/reclamations?detail=${reclamation.id}`,
        });
      }
      return a;
    });

    return NextResponse.json({ data: action }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/reclamations/[id]/actions:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
