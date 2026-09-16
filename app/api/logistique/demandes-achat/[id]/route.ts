import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getVisaRpvOuChefAgenceSession } from "@/lib/authRPV";
import { auditLog, notify } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { getSession } from "../../fournisseurs/route";
import { INCLUDE } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = (await getSession()) ?? (await getVisaRpvOuChefAgenceSession());
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const demande = await prisma.demandeAchatInterne.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!demande) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

    return NextResponse.json({ data: demande });
  } catch (error) {
    console.error("GET /logistique/demandes-achat/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/logistique/demandes-achat/[id]
 * Body : { action: "VISER" | "REJETER" | "ANNULER" | "CLOTURER" }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const demandeId = Number(id);
    const demande = await prisma.demandeAchatInterne.findUnique({ where: { id: demandeId } });
    if (!demande) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

    const body = await req.json();

    if (body.action === "VISER") {
      const session = await getVisaRpvOuChefAgenceSession();
      if (!session) return NextResponse.json({ error: "Visa réservé au Responsable Point de Vente / Chef d'agence / Direction" }, { status: 403 });
      if (demande.statut !== "EN_VALIDATION") {
        return NextResponse.json({ error: `Impossible depuis le statut ${demande.statut}` }, { status: 422 });
      }
      const userId = parseInt(session.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        const d = await tx.demandeAchatInterne.update({
          where: { id: demandeId },
          data: { statut: "APPROUVEE", viseParId: userId, dateVisa: new Date() },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "DAI_VISEE", "DemandeAchatInterne", demandeId, undefined, getRequestMeta(req));
        await notify(tx, [demande.demandeurId], {
          titre: `Demande d'achat ${demande.reference} approuvée`,
          message: `Visée par ${session.user.prenom} ${session.user.nom} — vous pouvez lancer une consultation fournisseur (RFQ).`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/logistiquesApprovisionnements/demandes-achat?detail=${demandeId}`,
        });
        return d;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "REJETER") {
      const session = await getVisaRpvOuChefAgenceSession();
      if (!session) return NextResponse.json({ error: "Réservé au Responsable Point de Vente / Chef d'agence / Direction" }, { status: 403 });
      if (demande.statut !== "EN_VALIDATION") {
        return NextResponse.json({ error: `Impossible depuis le statut ${demande.statut}` }, { status: 422 });
      }
      const motifRejet = String(body.motifRejet || "").trim();
      if (!motifRejet) return NextResponse.json({ error: "Motif de rejet obligatoire" }, { status: 400 });
      const userId = parseInt(session.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        const d = await tx.demandeAchatInterne.update({
          where: { id: demandeId },
          data: { statut: "REJETEE", motifRejet, viseParId: userId, dateVisa: new Date() },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "DAI_REJETEE", "DemandeAchatInterne", demandeId, { motifRejet }, getRequestMeta(req));
        await notify(tx, [demande.demandeurId], {
          titre: `Demande d'achat ${demande.reference} rejetée`,
          message: `Motif : ${motifRejet}`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/user/logistiquesApprovisionnements/demandes-achat?detail=${demandeId}`,
        });
        return d;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "ANNULER") {
      const session = await getSession();
      const isOwnerOrAdmin = session && (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN" || parseInt(session.user.id) === demande.demandeurId);
      if (!isOwnerOrAdmin) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      if (!["SOUMISE", "EN_VALIDATION", "APPROUVEE"].includes(demande.statut)) {
        return NextResponse.json({ error: `Impossible depuis le statut ${demande.statut}` }, { status: 422 });
      }
      const userId = parseInt(session!.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        const d = await tx.demandeAchatInterne.update({ where: { id: demandeId }, data: { statut: "ANNULEE" }, include: INCLUDE });
        await auditLog(tx, userId, "DAI_ANNULEE", "DemandeAchatInterne", demandeId, undefined, getRequestMeta(req));
        return d;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "CLOTURER") {
      const session = await getSession();
      if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      if (demande.statut !== "APPROUVEE") {
        return NextResponse.json({ error: "Seule une demande approuvée peut être clôturée" }, { status: 422 });
      }
      const userId = parseInt(session.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        const d = await tx.demandeAchatInterne.update({ where: { id: demandeId }, data: { statut: "CLOTUREE" }, include: INCLUDE });
        await auditLog(tx, userId, "DAI_CLOTUREE", "DemandeAchatInterne", demandeId, undefined, getRequestMeta(req));
        return d;
      });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /logistique/demandes-achat/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
