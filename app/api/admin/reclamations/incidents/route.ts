import { NextResponse } from "next/server";
import { TypeIncidentCommercial } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getReclamationSession } from "@/lib/authReclamation";
import { resolvePdvIdsAutorises } from "@/lib/reclamationClient";
import { genererReferenceUnique } from "@/lib/depotVente";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * "Rapport d'incident" commercial (CDC §5.8) — incident lié à une vente ou
 * une livraison, distinct du RapportIncident SST. Peut être rattaché à une
 * réclamation (reclamationId) ou déclaré seul.
 */

export async function GET(req: Request) {
  try {
    const session = await getReclamationSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const reclamationId = searchParams.get("reclamationId");

    const incidents = await prisma.incidentCommercial.findMany({
      where: reclamationId ? { reclamationId: Number(reclamationId) } : {},
      include: { declarePar: { select: { id: true, nom: true, prenom: true } } },
      orderBy: { dateIncident: "desc" },
    });
    return NextResponse.json({ data: incidents });
  } catch (error) {
    console.error("GET /admin/reclamations/incidents:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/reclamations/incidents
 * Body: { reclamationId?, dateIncident, lieu, type, description, personnesImpliquees?, actionsCorrectives? }
 */
export async function POST(req: Request) {
  try {
    const session = await getReclamationSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const type = body.type as TypeIncidentCommercial;
    if (!Object.values(TypeIncidentCommercial).includes(type)) {
      return NextResponse.json({ error: "Type d'incident invalide" }, { status: 400 });
    }
    if (!body.lieu || !String(body.lieu).trim()) return NextResponse.json({ error: "Le lieu est obligatoire" }, { status: 400 });
    if (!body.description || !String(body.description).trim()) return NextResponse.json({ error: "La description est obligatoire" }, { status: 400 });
    if (!body.dateIncident) return NextResponse.json({ error: "La date de l'incident est obligatoire" }, { status: 400 });

    let reclamationId: number | null = null;
    if (body.reclamationId) {
      const pdvIds = await resolvePdvIdsAutorises(session);
      const reclamation = await prisma.reclamationClient.findUnique({
        where: { id: Number(body.reclamationId) },
        select: { id: true, numero: true, pointDeVenteId: true },
      });
      if (!reclamation) return NextResponse.json({ error: "Réclamation introuvable" }, { status: 404 });
      if (pdvIds !== null && (!reclamation.pointDeVenteId || !pdvIds.includes(reclamation.pointDeVenteId))) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      reclamationId = reclamation.id;
    }

    const userId = Number(session.user.id);

    const incident = await genererReferenceUnique(
      "INC",
      () => prisma.incidentCommercial.count(),
      (numero) => prisma.$transaction(async (tx) => {
        const inc = await tx.incidentCommercial.create({
          data: {
            numero,
            reclamationId,
            dateIncident: new Date(body.dateIncident),
            lieu: String(body.lieu).trim(),
            type,
            description: String(body.description).trim(),
            personnesImpliquees: body.personnesImpliquees?.trim() || null,
            actionsCorrectives: body.actionsCorrectives?.trim() || null,
            declareParId: userId,
          },
        });
        if (reclamationId) {
          await tx.actionReclamation.create({
            data: { reclamationId, type: "INVESTIGATION", description: `Rapport d'incident ${inc.numero} créé`, auteurId: userId },
          });
        }
        await auditLog(tx, userId, "INCIDENT_COMMERCIAL_DECLARE", "IncidentCommercial", inc.id, undefined, getRequestMeta(req));
        await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE", "CHEF_AGENCE"], {
          titre: `Incident commercial déclaré — ${inc.numero}`,
          message: `${session.user.prenom} ${session.user.nom} a déclaré un incident (${type}) : ${String(body.lieu).trim()}.`,
          priorite: "NORMAL",
          actionUrl: `/dashboard/admin/reclamations${reclamationId ? `?detail=${reclamationId}` : ""}`,
        });
        return inc;
      }),
    );

    return NextResponse.json({ data: incident }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/reclamations/incidents:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
