import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { genererReferenceUnique } from "@/lib/depotVente";
import { PrioriteNotification } from "@prisma/client";
import { INCLUDE } from "../route";

type Ctx = { params: Promise<{ id: string; commandeId: string }> };

const DETAIL_INCLUDE = {
  ...INCLUDE,
  bonLivraison: { include: { lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true } } } }, livreur: { select: { nom: true, prenom: true } } } },
  facture: { include: { lignes: true } },
};

/** GET /api/admin/revendeurs/[id]/commandes/[commandeId] — détail complet (impression). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, commandeId } = await params;
    const profil = await prisma.profilRevendeur.findUnique({ where: { id: Number(id) }, select: { userId: true, raisonSociale: true } });
    if (!profil) return NextResponse.json({ error: "Revendeur introuvable" }, { status: 404 });

    const commande = await prisma.commandeRevendeur.findUnique({ where: { id: Number(commandeId) }, include: DETAIL_INCLUDE });
    if (!commande || commande.revendeurId !== profil.userId) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    }
    return NextResponse.json({ data: commande, revendeur: profil });
  } catch (error) {
    console.error("GET /admin/revendeurs/[id]/commandes/[commandeId]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/revendeurs/[id]/commandes/[commandeId]
 * Actions :
 * - CONFIRMER  — décrémente le stock, génère le "Bon de livraison revendeur"
 * - FACTURER   — génère la "Facture revendeur" (FactureVente type REVENDEUR)
 * - ANNULER    — annule (uniquement si pas encore confirmée)
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, commandeId } = await params;
    const profil = await prisma.profilRevendeur.findUnique({ where: { id: Number(id) }, select: { userId: true, raisonSociale: true } });
    if (!profil) return NextResponse.json({ error: "Revendeur introuvable" }, { status: 404 });

    const cId = Number(commandeId);
    const commande = await prisma.commandeRevendeur.findUnique({
      where: { id: cId },
      include: { lignes: true },
    });
    if (!commande || commande.revendeurId !== profil.userId) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    }

    const body = await req.json();
    const userId = parseInt(session.user.id);

    if (body.action === "CONFIRMER") {
      if (commande.statut !== "BROUILLON") return NextResponse.json({ error: `Impossible depuis le statut ${commande.statut}` }, { status: 422 });

      const stocks = await prisma.stockSite.findMany({
        where: { pointDeVenteId: commande.pointDeVenteId, produitId: { in: commande.lignes.map((l) => l.produitId) } },
        select: { produitId: true, quantite: true },
      });
      const stockParProduit = new Map(stocks.map((s) => [s.produitId, s.quantite]));
      for (const l of commande.lignes) {
        const dispo = stockParProduit.get(l.produitId) ?? 0;
        if (dispo < l.quantite) {
          return NextResponse.json({ error: `Stock insuffisant pour le produit ${l.produitId} (dispo ${dispo}, demandé ${l.quantite})` }, { status: 422 });
        }
      }

      const bonLivraison = await genererReferenceUnique(
        "BLR",
        () => prisma.bonLivraisonRevendeur.count(),
        (reference) => prisma.$transaction(async (tx) => {
          for (const l of commande.lignes) {
            await tx.stockSite.update({
              where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: commande.pointDeVenteId } },
              data: { quantite: { decrement: l.quantite } },
            });
            await tx.mouvementStock.create({
              data: {
                produitId: l.produitId,
                pointDeVenteId: commande.pointDeVenteId,
                type: "SORTIE",
                typeSortie: "VENTE_REVENDEUR",
                quantite: l.quantite,
                prixUnitaire: l.prixUnitaire,
                motif: `Commande revendeur ${commande.reference}`,
                reference: `${commande.reference}-P${l.produitId}-${randomUUID().slice(0, 4).toUpperCase()}`,
                operateurId: userId,
              },
            });
          }

          const bl = await tx.bonLivraisonRevendeur.create({
            data: {
              reference,
              commandeRevendeurId: cId,
              lignes: { create: commande.lignes.map((l) => ({ produitId: l.produitId, quantite: l.quantite })) },
            },
          });
          await tx.commandeRevendeur.update({ where: { id: cId }, data: { statut: "CONFIRMEE" } });
          await auditLog(tx, userId, "BCR_CONFIRMEE", "CommandeRevendeur", cId, { bonLivraisonId: bl.id }, getRequestMeta(req));
          return bl;
        }),
      );

      const updated = await prisma.commandeRevendeur.findUnique({ where: { id: cId }, include: INCLUDE });
      return NextResponse.json({ data: updated, bonLivraison });
    }

    if (body.action === "FACTURER") {
      if (commande.statut !== "CONFIRMEE") return NextResponse.json({ error: "La commande doit être confirmée avant facturation" }, { status: 422 });
      if (commande.factureId) return NextResponse.json({ error: "Déjà facturée" }, { status: 422 });

      const revendeurUser = await prisma.user.findUnique({ where: { id: commande.revendeurId }, select: { nom: true, prenom: true, telephone: true } });

      const facture = await genererReferenceUnique(
        "FAC",
        () => prisma.factureVente.count(),
        (numero) => prisma.$transaction(async (tx) => {
          const f = await tx.factureVente.create({
            data: {
              numero,
              type: "REVENDEUR",
              statut: "EMISE",
              revendeurId: commande.revendeurId,
              clientNom: profil.raisonSociale,
              clientTelephone: revendeurUser?.telephone ?? null,
              pointDeVenteId: commande.pointDeVenteId,
              emiseParId: userId,
              emiseParNom: `${session.user.prenom} ${session.user.nom}`,
              montantHT: commande.totalTTC,
              montantTTC: commande.totalTTC,
              lignes: {
                create: commande.lignes.map((l) => ({
                  designation: `Produit #${l.produitId}`,
                  quantite: l.quantite,
                  prixUnitaire: l.prixUnitaire,
                  montant: l.montantLigne,
                })),
              },
            },
          });
          await tx.commandeRevendeur.update({ where: { id: cId }, data: { statut: "FACTUREE", factureId: f.id } });
          await auditLog(tx, userId, "BCR_FACTUREE", "CommandeRevendeur", cId, { factureId: f.id }, getRequestMeta(req));
          await notifyRoles(tx, ["RESPONSABLE_VENTE_CREDIT", "COMPTABLE"], {
            titre: `Facture revendeur émise (${numero})`,
            message: `Facture ${numero} émise pour ${profil.raisonSociale} — ${Number(commande.totalTTC).toLocaleString("fr-FR")} FCFA.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/admin/revendeurs/${id}`,
          });
          return f;
        }),
      );

      const updated = await prisma.commandeRevendeur.findUnique({ where: { id: cId }, include: INCLUDE });
      return NextResponse.json({ data: updated, facture });
    }

    if (body.action === "ANNULER") {
      if (commande.statut !== "BROUILLON") return NextResponse.json({ error: "Seule une commande en brouillon peut être annulée" }, { status: 422 });
      const updated = await prisma.$transaction(async (tx) => {
        const c = await tx.commandeRevendeur.update({ where: { id: cId }, data: { statut: "ANNULEE" }, include: INCLUDE });
        await auditLog(tx, userId, "BCR_ANNULEE", "CommandeRevendeur", cId, undefined, getRequestMeta(req));
        return c;
      });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /admin/revendeurs/[id]/commandes/[commandeId]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
