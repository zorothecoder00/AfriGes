import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReclamationSession } from "@/lib/authReclamation";
import { resolvePdvIdsAutorises } from "@/lib/reclamationClientServer";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genRapportIncidentCommercialHtml } from "@/lib/rapportIncidentCommercialHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ incidentId: string }> };

/** GET /api/admin/reclamations/incidents/[incidentId]/pdf — Rapport d'incident (CDC digitalisation §5.8). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getReclamationSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { incidentId } = await params;
    const incident = await prisma.incidentCommercial.findUnique({
      where: { id: Number(incidentId) },
      include: { declarePar: { select: { nom: true, prenom: true } }, reclamation: { select: { id: true, numero: true, pointDeVenteId: true } } },
    });
    if (!incident) return NextResponse.json({ error: "Incident introuvable" }, { status: 404 });

    if (incident.reclamation) {
      const pdvIds = await resolvePdvIdsAutorises(session);
      if (pdvIds !== null && (!incident.reclamation.pointDeVenteId || !pdvIds.includes(incident.reclamation.pointDeVenteId))) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const qrUrl = qrInstanceUrl(req, "INC", incident.id, incident.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genRapportIncidentCommercialHtml({
      numero: incident.numero, dateIncident: incident.dateIncident, lieu: incident.lieu, type: incident.type,
      description: incident.description, personnesImpliquees: incident.personnesImpliquees, actionsCorrectives: incident.actionsCorrectives,
      statut: incident.statut, declarePar: incident.declarePar, reclamation: incident.reclamation,
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `incident-${incident.numero}.pdf`);
  } catch (error) {
    console.error("GET /admin/reclamations/incidents/[incidentId]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
