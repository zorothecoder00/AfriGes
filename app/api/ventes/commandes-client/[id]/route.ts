import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { auditLog, notify, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { tariferLigne } from "@/lib/venteTarification";
import { resoudreTvaVente, decomposerTTC } from "@/lib/comptabilite/tva";
import { getSeuilRemiseCommandeClient } from "@/lib/parametresDocuments";
import { getCreateSession, getViewSession, INCLUDE } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getViewSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const commande = await prisma.commandeClient.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!commande) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

    const isRVCOuAdmin = !!(await getRVCSession());
    if (!isRVCOuAdmin && commande.agentId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Disponibilité stock temps réel (indicatif — CDC §3.2, ne bloque pas la saisie).
    const stocks = await prisma.stockSite.findMany({
      where: { pointDeVenteId: commande.pointDeVenteId, produitId: { in: commande.lignes.map((l) => l.produitId) } },
      select: { produitId: true, quantite: true, quantiteReservee: true },
    });
    const stockParProduit = new Map(stocks.map((s) => [s.produitId, s.quantite - s.quantiteReservee]));
    const lignesAvecStock = commande.lignes.map((l) => ({
      ...l,
      stockDisponible: stockParProduit.get(l.produitId) ?? 0,
      ruptureSignalee: (stockParProduit.get(l.produitId) ?? 0) < l.quantite,
    }));

    const seuilRemise = await getSeuilRemiseCommandeClient();
    return NextResponse.json({ data: { ...commande, lignes: lignesAvecStock }, seuilRemise });
  } catch (error) {
    console.error("GET /ventes/commandes-client/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

interface LigneInput { produitId: number; quantite: number; remisePourcent?: number }

async function genererBonSortiePourCommande(
  tx: Prisma.TransactionClient,
  commande: { id: number; reference: string; pointDeVenteId: number },
  lignes: { produitId: number; quantite: number; prixUnitaire: Prisma.Decimal | number }[],
  userId: number,
) {
  const refBS = `BS-${Date.now()}-${commande.id}`;
  const montantTotalBS = lignes.reduce((s, l) => s + l.quantite * Number(l.prixUnitaire), 0);
  const bonSortie = await tx.bonSortie.create({
    data: {
      reference: refBS,
      typeSortie: "LIVRAISON_CLIENT",
      statut: "BROUILLON",
      pointDeVenteId: commande.pointDeVenteId,
      motif: `Commande client ${commande.reference}`,
      montantTotal: montantTotalBS,
      creeParId: userId,
      lignes: { create: lignes.map((l) => ({ produitId: l.produitId, quantite: l.quantite, quantiteDemandee: l.quantite, prixUnit: Number(l.prixUnitaire) })) },
    },
  });
  await tx.commandeClient.update({ where: { id: commande.id }, data: { bonSortieId: bonSortie.id, statut: "EN_PREPARATION" } });

  // Bon de Préparation (CDC digitalisation §5.7) — liste de prélèvement du magasinier,
  // pré-remplie aux quantités demandées ; "Marquer prête" répercutera les quantités
  // réellement prélevées sur les lignes du Bon de Sortie avant confirmation d'expédition.
  await tx.bonPreparation.create({
    data: {
      reference: `BP-${Date.now()}-${commande.id}`,
      bonSortieId: bonSortie.id,
      commandeClientId: commande.id,
      lignes: { create: lignes.map((l) => ({ produitId: l.produitId, quantiteDemandee: l.quantite, quantitePreparee: l.quantite })) },
    },
  });

  await notifyRoles(tx, ["MAGAZINIER", "RESPONSABLE_POINT_DE_VENTE"], {
    titre: `Commande client à préparer (${commande.reference})`,
    message: `Bon de sortie ${refBS} en attente de préparation.`,
    priorite: PrioriteNotification.NORMAL,
    actionUrl: `/dashboard/magasinier/bons-sortie/${bonSortie.id}`,
  });
  return bonSortie;
}

/**
 * PATCH /api/ventes/commandes-client/[id]
 * - Actions : { action: "VISER" | "REJETER" | "ANNULER" | "CLOTURER" }
 * - Édition (lignes, notes, livraison) : tant que SOUMISE/EN_VALIDATION uniquement.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const commandeId = Number(id);
    const commande = await prisma.commandeClient.findUnique({ where: { id: commandeId }, include: { lignes: true, client: { select: { segment: true } } } });
    if (!commande) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

    const body = await req.json();

    if (body.action === "VISER") {
      const session = await getRVCSession();
      if (!session) return NextResponse.json({ error: "Réservé au Responsable Vente Crédit" }, { status: 403 });
      if (commande.statut !== "EN_VALIDATION") {
        return NextResponse.json({ error: `Impossible depuis le statut ${commande.statut}` }, { status: 422 });
      }
      const userId = parseInt(session.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        await tx.commandeClient.update({ where: { id: commandeId }, data: { visaResponsableParId: userId, dateVisaResponsable: new Date() } });
        await genererBonSortiePourCommande(tx, commande, commande.lignes, userId);
        await auditLog(tx, userId, "BCC_VISE", "CommandeClient", commandeId, undefined, getRequestMeta(req));
        return tx.commandeClient.findUnique({ where: { id: commandeId }, include: INCLUDE });
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "REJETER") {
      const session = await getRVCSession();
      if (!session) return NextResponse.json({ error: "Réservé au Responsable Vente Crédit" }, { status: 403 });
      if (commande.statut !== "EN_VALIDATION") {
        return NextResponse.json({ error: `Impossible depuis le statut ${commande.statut}` }, { status: 422 });
      }
      const motifRejet = String(body.motifRejet || "").trim();
      if (!motifRejet) return NextResponse.json({ error: "Motif de rejet obligatoire" }, { status: 400 });
      const userId = parseInt(session.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        const c = await tx.commandeClient.update({ where: { id: commandeId }, data: { statut: "REJETEE", motifRejet, visaResponsableParId: userId, dateVisaResponsable: new Date() }, include: INCLUDE });
        await auditLog(tx, userId, "BCC_REJETEE", "CommandeClient", commandeId, { motifRejet }, getRequestMeta(req));
        await notify(tx, [commande.agentId], {
          titre: `Commande ${commande.reference} rejetée`,
          message: `Motif : ${motifRejet}`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/user/agentsTerrain/commandes-client?detail=${commandeId}`,
        });
        return c;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "ANNULER") {
      const session = await getCreateSession();
      const isOwnerOrAdmin = session && (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN" || parseInt(session.user.id) === commande.agentId);
      const rvc = await getRVCSession();
      if (!isOwnerOrAdmin && !rvc) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      if (!["SOUMISE", "EN_VALIDATION"].includes(commande.statut)) {
        return NextResponse.json({ error: "La commande a déjà été prise en charge par le magasinier : un avenant est requis" }, { status: 422 });
      }
      const userId = parseInt((session ?? rvc)!.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        const c = await tx.commandeClient.update({ where: { id: commandeId }, data: { statut: "ANNULEE" }, include: INCLUDE });
        await auditLog(tx, userId, "BCC_ANNULEE", "CommandeClient", commandeId, undefined, getRequestMeta(req));
        return c;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "CLOTURER") {
      const session = await getCreateSession();
      const isOwnerOrAdmin = session && (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN" || parseInt(session.user.id) === commande.agentId);
      if (!isOwnerOrAdmin) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      if (commande.statut !== "LIVREE") {
        return NextResponse.json({ error: "La commande doit être livrée avant clôture" }, { status: 422 });
      }
      const userId = parseInt(session!.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        const c = await tx.commandeClient.update({ where: { id: commandeId }, data: { statut: "CLOTUREE" }, include: INCLUDE });
        await auditLog(tx, userId, "BCC_CLOTUREE", "CommandeClient", commandeId, undefined, getRequestMeta(req));
        return c;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action) return NextResponse.json({ error: "Action invalide" }, { status: 400 });

    // ── Édition (SOUMISE / EN_VALIDATION uniquement) ─────────────────────────
    const session = await getCreateSession();
    const isOwnerOrAdmin = session && (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN" || parseInt(session.user.id) === commande.agentId);
    if (!isOwnerOrAdmin) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    if (!["SOUMISE", "EN_VALIDATION"].includes(commande.statut)) {
      return NextResponse.json({ error: "Commande déjà prise en charge par le magasinier : modification impossible (avenant requis)" }, { status: 422 });
    }

    const userId = parseInt(session!.user.id);

    if (Array.isArray(body.lignes)) {
      const lignesInput = body.lignes as LigneInput[];
      for (const l of lignesInput) {
        if (!l.produitId || !l.quantite || l.quantite <= 0) {
          return NextResponse.json({ error: "Ligne invalide" }, { status: 400 });
        }
      }
      const seuilRemise = await getSeuilRemiseCommandeClient();
      const updated = await prisma.$transaction(async (tx) => {
        const produits = await Promise.all(
          lignesInput.map((l) => tx.produit.findUnique({ where: { id: Number(l.produitId) }, select: { id: true, nom: true, prixUnitaire: true, categorieId: true, familleId: true, marqueId: true } }))
        );
        if (produits.some((p) => !p)) throw new Error("Produit introuvable");

        const lignesCalc = await Promise.all(lignesInput.map(async (l, i) => {
          const produit = produits[i]!;
          const tarif = await tariferLigne(produit, l.quantite, { pointDeVenteId: commande.pointDeVenteId, clientId: commande.clientId, segment: commande.client.segment, aCredit: commande.modeReglement === "CREDIT" });
          const remisePourcent = Math.min(100, Math.max(0, Number(l.remisePourcent) || 0));
          const remiseMontant = Math.round(tarif.montant * remisePourcent / 100 * 100) / 100;
          const totalLigne = tarif.montant - remiseMontant;
          return { produitId: produit.id, quantite: l.quantite, prixUnitaire: tarif.prixUnitaire, remisePourcent, remiseMontant, totalLigne };
        }));

        const totalRemise = lignesCalc.reduce((s, l) => s + l.remiseMontant, 0);
        const totalTTC = lignesCalc.reduce((s, l) => s + l.totalLigne, 0);
        const tva = await resoudreTvaVente(tx);
        const { montantHT: totalHT, montantTVA: totalTVA } = tva ? decomposerTTC(totalTTC, tva.taux) : { montantHT: totalTTC, montantTVA: 0 };
        const visaRequis = totalRemise > seuilRemise || commande.modeReglement === "CREDIT";

        await tx.ligneCommandeClient.deleteMany({ where: { commandeId } });
        const c = await tx.commandeClient.update({
          where: { id: commandeId },
          data: {
            totalHT, totalRemise, totalTVA, totalTTC,
            statut: visaRequis ? "EN_VALIDATION" : commande.statut,
            notes: "notes" in body ? (body.notes || null) : undefined,
            dateLivraisonSouhaitee: "dateLivraisonSouhaitee" in body ? (body.dateLivraisonSouhaitee ? new Date(body.dateLivraisonSouhaitee) : null) : undefined,
            lieuLivraison: "lieuLivraison" in body ? (body.lieuLivraison || null) : undefined,
            lignes: { create: lignesCalc.map((l) => ({ produitId: l.produitId, quantite: l.quantite, prixUnitaire: l.prixUnitaire, remisePourcent: l.remisePourcent, remiseMontant: l.remiseMontant, totalLigne: l.totalLigne })) },
          },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "BCC_MODIFIEE", "CommandeClient", commandeId, undefined, getRequestMeta(req));
        return c;
      });
      return NextResponse.json({ data: updated });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if ("notes" in body) data.notes = body.notes || null;
    if ("dateLivraisonSouhaitee" in body) data.dateLivraisonSouhaitee = body.dateLivraisonSouhaitee ? new Date(body.dateLivraisonSouhaitee) : null;
    if ("lieuLivraison" in body) data.lieuLivraison = body.lieuLivraison || null;
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    const updated = await prisma.commandeClient.update({ where: { id: commandeId }, data, include: INCLUDE });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /ventes/commandes-client/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
