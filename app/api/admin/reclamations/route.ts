import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification, TypeReclamation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getReclamationSession } from "@/lib/authReclamation";
import { resolvePdvIdsAutorises } from "@/lib/reclamationClientServer";
import { genererReferenceUnique } from "@/lib/depotVente";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * Formulaire de réclamation client (CDC digitalisation §5.8) — point d'entrée
 * du circuit retours/réclamations. Namespace admin + Service Commercial
 * (RPV / Chef d'agence, cf. lib/authReclamation.ts).
 */

export const INCLUDE = {
  client: { select: { id: true, nom: true, prenom: true, telephone: true } },
  pointDeVente: { select: { id: true, nom: true, code: true } },
  creePar: { select: { id: true, nom: true, prenom: true } },
  assigneA: { select: { id: true, nom: true, prenom: true } },
  lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true } } } },
};

/** GET /api/admin/reclamations — liste, scopée PDV pour RPV/Chef d'agence. Query: statut?, clientId? */
export async function GET(req: Request) {
  try {
    const session = await getReclamationSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const pdvIds = await resolvePdvIdsAutorises(session);
    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const clientId = searchParams.get("clientId");

    const where: Prisma.ReclamationClientWhereInput = {};
    if (pdvIds !== null) where.pointDeVenteId = { in: pdvIds };
    if (statut) where.statut = statut as never;
    if (clientId) where.clientId = Number(clientId);

    const reclamations = await prisma.reclamationClient.findMany({
      where,
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: reclamations });
  } catch (error) {
    console.error("GET /admin/reclamations:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/reclamations
 * Body: { clientId, pointDeVenteId?, type, objet, description, sourceReference?,
 *         priorite?, lignes?: [{produitId, quantite, motif?}] }
 */
export async function POST(req: Request) {
  try {
    const session = await getReclamationSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const clientId = Number(body.clientId);
    if (!clientId) return NextResponse.json({ error: "Client obligatoire" }, { status: 400 });

    const type = body.type as TypeReclamation;
    if (!Object.values(TypeReclamation).includes(type)) {
      return NextResponse.json({ error: "Type de réclamation invalide" }, { status: 400 });
    }
    if (!body.objet || !String(body.objet).trim()) return NextResponse.json({ error: "L'objet est obligatoire" }, { status: 400 });
    if (!body.description || !String(body.description).trim()) return NextResponse.json({ error: "La description est obligatoire" }, { status: 400 });

    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, nom: true, prenom: true, pointDeVenteId: true } });
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    const pdvIds = await resolvePdvIdsAutorises(session);
    let pointDeVenteId = body.pointDeVenteId ? Number(body.pointDeVenteId) : client.pointDeVenteId ?? null;
    if (pdvIds !== null) {
      // RPV/Chef d'agence : forcer un PDV parmi ceux autorisés
      if (!pointDeVenteId || !pdvIds.includes(pointDeVenteId)) pointDeVenteId = pdvIds[0] ?? null;
    }

    const lignes = Array.isArray(body.lignes) ? body.lignes : [];
    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);

    const reclamation = await genererReferenceUnique(
      "REC",
      () => prisma.reclamationClient.count(),
      (numero) => prisma.$transaction(async (tx) => {
        const r = await tx.reclamationClient.create({
          data: {
            numero,
            clientId,
            pointDeVenteId,
            sourceReference: body.sourceReference?.trim() || null,
            type,
            objet: String(body.objet).trim(),
            description: String(body.description).trim(),
            priorite: (body.priorite as PrioriteNotification) || PrioriteNotification.NORMAL,
            creeParId: userId,
            lignes: {
              create: lignes
                .filter((l: { produitId?: number; quantite?: number }) => l.produitId && l.quantite)
                .map((l: { produitId: number; quantite: number; motif?: string }) => ({
                  produitId: Number(l.produitId),
                  quantite: Number(l.quantite),
                  motif: l.motif?.trim() || null,
                })),
            },
            actions: {
              create: { type: "PRISE_EN_CHARGE", description: "Réclamation enregistrée", auteurId: userId },
            },
          },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "RECLAMATION_ENREGISTREE", "ReclamationClient", r.id, undefined, meta);

        const clientNom = `${client.prenom} ${client.nom}`.trim();
        await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE", "CHEF_AGENCE"], {
          titre: `Nouvelle réclamation — ${r.numero}`,
          message: `${session.user.prenom} ${session.user.nom} a enregistré une réclamation "${type}" pour ${clientNom}.`,
          priorite: r.priorite,
          actionUrl: `/dashboard/admin/reclamations?detail=${r.id}`,
        });
        return r;
      }),
    );

    return NextResponse.json({ data: reclamation }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/reclamations:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
