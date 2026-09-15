import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog, notify } from "@/lib/notifications";

type Ctx = { params: Promise<{ token: string }> };

/**
 * POST /api/offres/[token]/repondre
 * Accès SANS login — le client accepte ou refuse un devis/proforma.
 * Body : { action: "ACCEPTER" | "REFUSER", nomSignataire?, motifRefus? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { token } = await params;
    const doc = await prisma.devisProforma.findUnique({
      where: { tokenReponse: token },
      select: { id: true, statut: true, dateValidite: true, reference: true, type: true, agentId: true, totalTTC: true },
    });
    if (!doc) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });

    const expire = doc.statut === "ENVOYE" && doc.dateValidite < new Date();
    if (expire) {
      await prisma.devisProforma.update({ where: { id: doc.id }, data: { statut: "EXPIRE" } });
      return NextResponse.json({ error: "Ce document a expiré" }, { status: 409 });
    }
    if (doc.statut !== "ENVOYE" && doc.statut !== "BROUILLON") {
      return NextResponse.json({ error: "Ce document a déjà reçu une réponse" }, { status: 409 });
    }

    const body = await req.json();
    const action = body.action;

    if (action === "ACCEPTER") {
      const nomSignataire = String(body.nomSignataire || "").trim();
      if (!nomSignataire) return NextResponse.json({ error: "Votre nom est obligatoire pour signer" }, { status: 400 });

      const updated = await prisma.$transaction(async (tx) => {
        const d = await tx.devisProforma.update({
          where: { id: doc.id },
          data: { statut: "ACCEPTE", dateReponse: new Date(), nomSignataireReponse: nomSignataire },
        });
        await auditLog(tx, doc.agentId, "DEVIS_PROFORMA_ACCEPTE", "DevisProforma", doc.id, { confirmationPublique: true });
        await notify(tx, [doc.agentId], {
          titre: `${doc.type === "PROFORMA" ? "Proforma" : "Devis"} ${doc.reference} accepté`,
          message: `${nomSignataire} a accepté l'offre de ${Number(doc.totalTTC).toLocaleString("fr-FR")} FCFA.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/agentsTerrain/devis-proforma?detail=${doc.id}`,
        });
        return d;
      });
      return NextResponse.json({ data: updated });
    }

    if (action === "REFUSER") {
      const motifRefus = String(body.motifRefus || "").trim() || "Non précisé";
      const updated = await prisma.$transaction(async (tx) => {
        const d = await tx.devisProforma.update({ where: { id: doc.id }, data: { statut: "REFUSE", dateReponse: new Date(), motifRefus } });
        await auditLog(tx, doc.agentId, "DEVIS_PROFORMA_REFUSE", "DevisProforma", doc.id, { motifRefus, confirmationPublique: true });
        await notify(tx, [doc.agentId], {
          titre: `${doc.type === "PROFORMA" ? "Proforma" : "Devis"} ${doc.reference} refusé`,
          message: `Motif : ${motifRefus}`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/user/agentsTerrain/devis-proforma?detail=${doc.id}`,
        });
        return d;
      });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  } catch (error) {
    console.error("POST /offres/[token]/repondre:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
