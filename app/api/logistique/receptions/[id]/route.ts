import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

async function getSession() {
  return (await getLogistiqueSession()) ?? (await getMagasinierSession());
}

/**
 * GET /api/logistique/receptions/[id]
 * Détail d'une réception.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    const reception = await prisma.receptionApprovisionnement.findUnique({
      where: { id: Number(id) },
      include: {
        pointDeVente:   { select: { id: true, nom: true, code: true, type: true } },
        fournisseur:    { select: { id: true, nom: true, contact: true, telephone: true } },
        origineDepot:   { select: { id: true, nom: true, code: true } },
        receptionnePar: { select: { id: true, nom: true, prenom: true } },
        validePar:      { select: { id: true, nom: true, prenom: true } },
        lignes: {
          include: {
            produit: { select: { id: true, nom: true, reference: true, unite: true, prixUnitaire: true } },
          },
        },
      },
    });

    if (!reception) return NextResponse.json({ error: "Réception introuvable" }, { status: 404 });
    return NextResponse.json({ data: reception });
  } catch (error) {
    console.error("GET /logistique/receptions/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/logistique/receptions/[id]
 * Mettre à jour et/ou valider une réception.
 *
 * Actions possibles via body.action :
 * - "DEMARRER"  → statut BROUILLON → EN_COURS
 * - "VALIDER"   → statut EN_COURS → VALIDE + mise en stock (StockSite + MouvementStock)
 * - "REJETER"   → statut → ANNULE
 * - (sans action) → mise à jour des lignes (quantiteRecue, etatQualite, notes) et notesQualite
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    const body = await req.json();
    const { action, notesQualite, lignesRecues } = body;

    const reception = await prisma.receptionApprovisionnement.findUnique({
      where: { id: Number(id) },
      include: {
        lignes: { include: { produit: { select: { id: true, nom: true } } } },
        pointDeVente: { select: { nom: true } },
      },
    });
    if (!reception) return NextResponse.json({ error: "Réception introuvable" }, { status: 404 });

    // ─ DEMARRER ──────────────────────────────────────────────
    if (action === "DEMARRER") {
      if (reception.statut !== "BROUILLON") {
        return NextResponse.json({ error: "Seule une réception BROUILLON peut être démarrée" }, { status: 400 });
      }
      const updated = await prisma.receptionApprovisionnement.update({
        where: { id: Number(id) },
        data: { statut: "EN_COURS" },
      });
      return NextResponse.json({ data: updated });
    }

    // ─ REJETER ──────────────────────────────────────────────
    if (action === "REJETER") {
      if (!["BROUILLON", "EN_COURS"].includes(reception.statut)) {
        return NextResponse.json({ error: "Cette réception ne peut plus être annulée" }, { status: 400 });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const r = await tx.receptionApprovisionnement.update({
          where: { id: Number(id) },
          data: { statut: "ANNULE", notesQualite: body.motif || null },
        });
        await auditLog(tx, parseInt(session.user.id), "RECEPTION_ANNULEE", "ReceptionApprovisionnement", r.id);
        return r;
      });
      return NextResponse.json({ data: updated });
    }

    // ─ VALIDER (mise en stock) ─────────────────────────────
    if (action === "VALIDER") {
      if (reception.statut !== "EN_COURS" && reception.statut !== "BROUILLON") {
        return NextResponse.json({ error: "Seule une réception EN_COURS ou BROUILLON peut être validée" }, { status: 400 });
      }

      // lignesRecues: [{ ligneId, quantiteRecue, etatQualite }]
      if (!lignesRecues || !Array.isArray(lignesRecues)) {
        return NextResponse.json({ error: "lignesRecues est obligatoire pour valider" }, { status: 400 });
      }

      const result = await prisma.$transaction(async (tx) => {
        // Mettre à jour chaque ligne avec les quantités reçues
        for (const lr of lignesRecues as Array<{ ligneId: number; quantiteRecue: number; etatQualite?: string; notes?: string }>) {
          await tx.ligneReceptionAppro.update({
            where: { id: Number(lr.ligneId) },
            data: {
              quantiteRecue: Number(lr.quantiteRecue),
              etatQualite:   lr.etatQualite || "BON",
              notes:         lr.notes       || null,
            },
          });
        }

        // Recharger les lignes mises à jour
        const lignesMaj = await tx.ligneReceptionAppro.findMany({
          where: { receptionId: Number(id) },
        });

        const typeEntree = reception.type === "FOURNISSEUR" ? "RECEPTION_FOURNISSEUR" : "RECEPTION_INTERNE";

        // Mettre en stock chaque produit reçu
        for (const ligne of lignesMaj) {
          const qte = ligne.quantiteRecue ?? ligne.quantiteAttendue;
          if (qte <= 0) continue;

          await tx.stockSite.upsert({
            where: {
              produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: reception.pointDeVenteId },
            },
            update: { quantite: { increment: qte } },
            create: { produitId: ligne.produitId, pointDeVenteId: reception.pointDeVenteId, quantite: qte },
          });

          await tx.mouvementStock.create({
            data: {
              produitId:       ligne.produitId,
              pointDeVenteId:  reception.pointDeVenteId,
              type:            "ENTREE",
              typeEntree,
              quantite:        qte,
              motif:           `Réception ${reception.reference} — ${reception.type}`,
              reference:       `${reception.reference}-P${ligne.produitId}-${randomUUID().slice(0, 4).toUpperCase()}`,
              operateurId:     parseInt(session.user.id),
              receptionApproId:Number(id),
            },
          });
        }

        const r = await tx.receptionApprovisionnement.update({
          where: { id: Number(id) },
          data: {
            statut:          "VALIDE",
            dateReception:   new Date(),
            controlQualite:  true,
            notesQualite:    notesQualite || null,
            valideParId:     parseInt(session.user.id),
          },
        });

        await auditLog(tx, parseInt(session.user.id), "RECEPTION_VALIDEE", "ReceptionApprovisionnement", r.id);

        await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {
          titre:    `Réception validée : ${reception.reference}`,
          message:  `${session.user.prenom} ${session.user.nom} a validé la réception "${reception.reference}" pour "${reception.pointDeVente.nom}". Stock mis à jour.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl:`/dashboard/logistique/receptions/${id}`,
        });

        return r;
      });

      return NextResponse.json({ data: result });
    }

    // ─ Mise à jour simple (sans action) ──────────────────────
    const updated = await prisma.receptionApprovisionnement.update({
      where: { id: Number(id) },
      data: { notesQualite: notesQualite || null },
    });
    return NextResponse.json({ data: updated });

  } catch (error) {
    console.error("PATCH /logistique/receptions/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
