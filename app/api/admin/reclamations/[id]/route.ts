import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReclamationSession } from "@/lib/authReclamation";
import { resolvePdvIdsAutorises } from "@/lib/reclamationClient";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { INCLUDE as LISTE_INCLUDE } from "../route";

type Ctx = { params: Promise<{ id: string }> };

const DETAIL_INCLUDE = {
  ...LISTE_INCLUDE,
  actions: { include: { auteur: { select: { id: true, nom: true, prenom: true } } }, orderBy: { dateAction: "desc" as const } },
  retours: {
    include: { lignes: { include: { produit: { select: { id: true, nom: true } } } }, magasinier: { select: { id: true, nom: true, prenom: true } } },
    orderBy: { createdAt: "desc" as const },
  },
  remplacements: {
    include: {
      produitOrigine: { select: { id: true, nom: true } },
      produitRemplacement: { select: { id: true, nom: true } },
      magasinier: { select: { id: true, nom: true, prenom: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  incidents: { orderBy: { createdAt: "desc" as const } },
  avoirs: { orderBy: { dateEmission: "desc" as const } },
};

async function chargerReclamationAutorisee(id: number, pdvIds: number[] | null) {
  const r = await prisma.reclamationClient.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!r) return null;
  if (pdvIds !== null && (!r.pointDeVenteId || !pdvIds.includes(r.pointDeVenteId))) return "forbidden" as const;
  return r;
}

/** GET /api/admin/reclamations/[id] — dossier complet (réclamation + traitement + retours + remplacements + incidents + avoirs). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getReclamationSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reclamationId = Number(id);
    if (isNaN(reclamationId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const pdvIds = await resolvePdvIdsAutorises(session);
    const r = await chargerReclamationAutorisee(reclamationId, pdvIds);
    if (r === null) return NextResponse.json({ error: "Réclamation introuvable" }, { status: 404 });
    if (r === "forbidden") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    return NextResponse.json({ data: r });
  } catch (error) {
    console.error("GET /admin/reclamations/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/reclamations/[id]
 * Body: { assigneAId? } — assignation
 *     | { statut: "EN_TRAITEMENT" }
 *     | { statut: "REJETEE", motifRejet }
 *     | { statut: "CLOTUREE", resumeCloture } — "Fiche de clôture de réclamation"
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getReclamationSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reclamationId = Number(id);
    if (isNaN(reclamationId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const pdvIds = await resolvePdvIdsAutorises(session);
    const existant = await chargerReclamationAutorisee(reclamationId, pdvIds);
    if (existant === null) return NextResponse.json({ error: "Réclamation introuvable" }, { status: 404 });
    if (existant === "forbidden") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    if (existant.statut === "CLOTUREE") return NextResponse.json({ error: "Réclamation déjà clôturée" }, { status: 409 });

    const body = await req.json();
    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      if (body.assigneAId !== undefined) {
        const assigneAId = body.assigneAId ? Number(body.assigneAId) : null;
        const r = await tx.reclamationClient.update({
          where: { id: reclamationId },
          data: { assigneAId },
          include: DETAIL_INCLUDE,
        });
        await auditLog(tx, userId, "RECLAMATION_ASSIGNEE", "ReclamationClient", reclamationId, { assigneAId }, meta);
        return r;
      }

      const statut = body.statut as string;
      if (statut === "EN_TRAITEMENT") {
        const r = await tx.reclamationClient.update({ where: { id: reclamationId }, data: { statut: "EN_TRAITEMENT" }, include: DETAIL_INCLUDE });
        await tx.actionReclamation.create({ data: { reclamationId, type: "INVESTIGATION", description: "Prise en charge du traitement", auteurId: userId } });
        await auditLog(tx, userId, "RECLAMATION_EN_TRAITEMENT", "ReclamationClient", reclamationId, undefined, meta);
        return r;
      }

      if (statut === "REJETEE") {
        if (!body.motifRejet || !String(body.motifRejet).trim()) throw new Error("Le motif de rejet est obligatoire");
        const r = await tx.reclamationClient.update({
          where: { id: reclamationId },
          data: { statut: "REJETEE", motifRejet: String(body.motifRejet).trim() },
          include: DETAIL_INCLUDE,
        });
        await tx.actionReclamation.create({ data: { reclamationId, type: "REJET", description: String(body.motifRejet).trim(), auteurId: userId } });
        await auditLog(tx, userId, "RECLAMATION_REJETEE", "ReclamationClient", reclamationId, { motif: body.motifRejet }, meta);
        await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE", "CHEF_AGENCE"], {
          titre: `Réclamation ${existant.numero} rejetée`,
          message: `${session.user.prenom} ${session.user.nom} a rejeté la réclamation : ${String(body.motifRejet).trim()}`,
          priorite: "HAUTE",
          actionUrl: `/dashboard/admin/reclamations?detail=${reclamationId}`,
        });
        return r;
      }

      if (statut === "CLOTUREE") {
        if (existant.statut !== "RESOLUE") throw new Error("La réclamation doit être résolue avant clôture");
        if (!body.resumeCloture || !String(body.resumeCloture).trim()) throw new Error("Le résumé de clôture est obligatoire");
        const r = await tx.reclamationClient.update({
          where: { id: reclamationId },
          data: {
            statut: "CLOTUREE",
            resumeCloture: String(body.resumeCloture).trim(),
            clotureParId: userId,
            clotureLe: new Date(),
          },
          include: DETAIL_INCLUDE,
        });
        await tx.actionReclamation.create({ data: { reclamationId, type: "CLOTURE", description: String(body.resumeCloture).trim(), auteurId: userId } });
        await auditLog(tx, userId, "RECLAMATION_CLOTUREE", "ReclamationClient", reclamationId, undefined, meta);
        return r;
      }

      throw new Error("Aucune modification reconnue dans la requête");
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    console.error("PATCH /admin/reclamations/[id]:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
