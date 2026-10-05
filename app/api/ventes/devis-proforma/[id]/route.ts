import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { nouveauJetonConfirmation, baseUrlPourLivraison } from "@/lib/livraisonConfirmation";
import { getCreateSession, INCLUDE, erreurLignesDevis, calculerLignesDevis, type LigneDevisInput } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getCreateSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    let document = await prisma.devisProforma.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!document) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    if (!isAdmin && document.agentId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (document.statut === "ENVOYE" && document.dateValidite < new Date()) {
      document = await prisma.devisProforma.update({ where: { id: document.id }, data: { statut: "EXPIRE" }, include: INCLUDE });
    }

    return NextResponse.json({ data: document });
  } catch (error) {
    console.error("GET /ventes/devis-proforma/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/ventes/devis-proforma/[id]
 * - Actions : { action: "ENVOYER" | "CONVERTIR_PROFORMA" | "ANNULER" }
 * - Édition (lignes, conditions, validité) : tant que BROUILLON uniquement.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getCreateSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const docId = Number(id);
    const document = await prisma.devisProforma.findUnique({ where: { id: docId }, include: { lignes: true, client: { select: { segment: true } } } });
    if (!document) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    if (!isAdmin && document.agentId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await req.json();
    const userId = parseInt(session.user.id);

    if (body.action === "ENVOYER") {
      if (document.statut !== "BROUILLON") return NextResponse.json({ error: `Impossible depuis le statut ${document.statut}` }, { status: 422 });
      const horsCatalogue = document.lignes.filter((l) => l.produitId == null);
      if (horsCatalogue.length > 0) {
        return NextResponse.json({
          error: `${horsCatalogue.length} produit(s) hors catalogue (${horsCatalogue.map((l) => l.designationLibre).join(", ")}) : associez-les à un produit du catalogue (Ajuster) avant l'envoi au client.`,
        }, { status: 422 });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const d = await tx.devisProforma.update({ where: { id: docId }, data: { statut: "ENVOYE", dateEnvoi: new Date() }, include: INCLUDE });
        await auditLog(tx, userId, "DEVIS_PROFORMA_ENVOYE", "DevisProforma", docId, undefined, getRequestMeta(req));
        return d;
      });
      const lien = `${baseUrlPourLivraison(req)}/offre/${document.tokenReponse}`;
      return NextResponse.json({ data: updated, lien });
    }

    if (body.action === "CONVERTIR_PROFORMA") {
      if (document.type !== "DEVIS") return NextResponse.json({ error: "Seul un devis peut être converti en proforma" }, { status: 422 });
      if (document.statut !== "ACCEPTE") return NextResponse.json({ error: "Le devis doit être accepté par le client avant conversion" }, { status: 422 });
      const existant = await prisma.devisProforma.findUnique({ where: { devisOrigineId: docId } });
      if (existant) return NextResponse.json({ error: "Ce devis a déjà été converti en proforma" }, { status: 422 });

      const prefixe = "PRO";
      for (let attempt = 0; attempt < 6; attempt++) {
        const count = await prisma.devisProforma.count();
        const annee = new Date().getFullYear();
        const reference = `${prefixe}-${annee}-${String(count + 1 + attempt).padStart(6, "0")}`;
        try {
          const proforma = await prisma.$transaction(async (tx) => {
            const p = await tx.devisProforma.create({
              data: {
                reference, type: "PROFORMA", statut: "BROUILLON",
                agentId: document.agentId, pointDeVenteId: document.pointDeVenteId, clientId: document.clientId,
                dateValidite: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
                conditions: document.conditions,
                totalHT: document.totalHT, totalRemise: document.totalRemise, totalTVA: document.totalTVA, totalTTC: document.totalTTC,
                tokenReponse: nouveauJetonConfirmation(),
                devisOrigineId: docId,
                notes: document.notes,
                lignes: { create: document.lignes.map((l) => ({ produitId: l.produitId, designationLibre: l.designationLibre, quantite: l.quantite, prixUnitaire: l.prixUnitaire, remisePourcent: l.remisePourcent, remiseMontant: l.remiseMontant, totalLigne: l.totalLigne })) },
              },
              include: INCLUDE,
            });
            await auditLog(tx, userId, "DEVIS_CONVERTI_PROFORMA", "DevisProforma", p.id, { devisOrigineId: docId }, getRequestMeta(req));
            return p;
          });
          return NextResponse.json({ data: proforma }, { status: 201 });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          if (e?.code === "P2002") continue;
          throw e;
        }
      }
      return NextResponse.json({ error: "Impossible de générer une référence unique" }, { status: 500 });
    }

    if (body.action === "ANNULER") {
      if (!["BROUILLON", "ENVOYE"].includes(document.statut)) {
        return NextResponse.json({ error: `Impossible depuis le statut ${document.statut}` }, { status: 422 });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const d = await tx.devisProforma.update({ where: { id: docId }, data: { statut: "REFUSE", motifRefus: "Annulé en interne" }, include: INCLUDE });
        await auditLog(tx, userId, "DEVIS_PROFORMA_ANNULE", "DevisProforma", docId, undefined, getRequestMeta(req));
        return d;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action) return NextResponse.json({ error: "Action invalide" }, { status: 400 });

    // ── Édition (BROUILLON uniquement) ────────────────────────────────────
    if (document.statut !== "BROUILLON") {
      return NextResponse.json({ error: "Seul un document en brouillon peut être modifié" }, { status: 422 });
    }

    if (Array.isArray(body.lignes)) {
      const lignesInput = body.lignes as LigneDevisInput[];
      const estAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
      // L'Admin associe ou retire les lignes hors catalogue de l'agent, mais n'en crée pas de nouvelles.
      const designationsExistantes = new Set(document.lignes.filter((l) => l.produitId == null).map((l) => l.designationLibre));
      const erreurLignes = erreurLignesDevis(lignesInput, (d) => !estAdmin || designationsExistantes.has(d));
      if (erreurLignes) return NextResponse.json({ error: erreurLignes }, { status: 400 });
      const updated = await prisma.$transaction(async (tx) => {
        const { lignes: lignesCalc, totalHT, totalRemise, totalTVA, totalTTC } = await calculerLignesDevis(tx, lignesInput, {
          pointDeVenteId: document.pointDeVenteId, clientId: document.clientId, segment: document.client.segment,
        });

        await tx.ligneDevisProforma.deleteMany({ where: { devisProformaId: docId } });
        const d = await tx.devisProforma.update({
          where: { id: docId },
          data: {
            totalHT, totalRemise, totalTVA, totalTTC,
            conditions: "conditions" in body ? (body.conditions || null) : undefined,
            dateValidite: "dateValidite" in body && body.dateValidite ? new Date(body.dateValidite) : undefined,
            notes: "notes" in body ? (body.notes || null) : undefined,
            lignes: { create: lignesCalc.map((l) => ({ produitId: l.produitId, designationLibre: l.designationLibre, quantite: l.quantite, prixUnitaire: l.prixUnitaire, remisePourcent: l.remisePourcent, remiseMontant: l.remiseMontant, totalLigne: l.totalLigne })) },
          },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "DEVIS_PROFORMA_MODIFIE", "DevisProforma", docId, undefined, getRequestMeta(req));
        return d;
      });
      return NextResponse.json({ data: updated });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if ("conditions" in body) data.conditions = body.conditions || null;
    if ("dateValidite" in body && body.dateValidite) data.dateValidite = new Date(body.dateValidite);
    if ("notes" in body) data.notes = body.notes || null;
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    const updated = await prisma.devisProforma.update({ where: { id: docId }, data, include: INCLUDE });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /ventes/devis-proforma/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
