import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { PrioriteNotification } from "@prisma/client";
import { INCLUDE } from "../route";

type Ctx = { params: Promise<{ id: string }> };

/** Constat physique d'entrée / reprise des invendus : logistique OU magasinier (même split que les réceptions d'appro). */
async function getSessionPhysique() {
  const logistique = await getLogistiqueSession();
  if (logistique) return logistique;
  return getMagasinierSession();
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSessionPhysique();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const depot = await prisma.depotMarchandise.findUnique({
      where: { id: Number(id) },
      include: { ...INCLUDE, lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true } }, lotProduit: { select: { id: true, quantite: true, quantiteInitiale: true, statut: true } } } } },
    });
    if (!depot) return NextResponse.json({ error: "Dépôt introuvable" }, { status: 404 });

    return NextResponse.json({ data: depot });
  } catch (error) {
    console.error("GET /logistique/depot-vente/depots/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

interface ReprisInput { ligneId: number; quantite: number }

/**
 * PATCH /api/logistique/depot-vente/depots/[id]
 * Actions :
 * - { action: "CONSTATER_ENTREE" } — "Bon d'entrée en dépôt" : crée un lot dédié
 *   par ligne, incrémente le stock, journalise l'entrée.
 * - { action: "REPRISE_INVENDUS", lignes: [{ligneId, quantite}] } — "Bon de
 *   sortie / reprise des invendus" : décrémente stock+lot, génère un Bon de
 *   Sortie RETOUR_FOURNISSEUR déjà validé (constat, pas un workflow à approuver).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSessionPhysique();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const depotId = Number(id);
    const depot = await prisma.depotMarchandise.findUnique({
      where: { id: depotId },
      include: { lignes: true, convention: { select: { fournisseurId: true } } },
    });
    if (!depot) return NextResponse.json({ error: "Dépôt introuvable" }, { status: 404 });

    const body = await req.json();
    const userId = parseInt(session.user.id);

    if (body.action === "CONSTATER_ENTREE") {
      if (depot.statut !== "BROUILLON") {
        return NextResponse.json({ error: `Impossible depuis le statut ${depot.statut}` }, { status: 422 });
      }

      const updated = await prisma.$transaction(async (tx) => {
        for (const l of depot.lignes) {
          const numeroLot = `${depot.reference}-P${l.produitId}`;
          const lot = await tx.lotProduit.create({
            data: {
              numeroLot,
              produitId: l.produitId,
              pointDeVenteId: depot.pointDeVenteId,
              quantiteInitiale: l.quantiteDeposee,
              quantite: l.quantiteDeposee,
              dlc: l.dlc,
              prixAchat: null, // pas d'achat : marchandise déposée, pas acquise
              fournisseurId: depot.convention.fournisseurId,
              creeParId: userId,
            },
          });
          await tx.mouvementLot.create({
            data: { lotId: lot.id, type: "ENTREE", quantite: l.quantiteDeposee, motif: `Dépôt-vente ${depot.reference}`, operateurId: userId },
          });
          await tx.ligneDepotMarchandise.update({ where: { id: l.id }, data: { lotProduitId: lot.id } });

          await tx.stockSite.upsert({
            where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: depot.pointDeVenteId } },
            update: { quantite: { increment: l.quantiteDeposee } },
            create: { produitId: l.produitId, pointDeVenteId: depot.pointDeVenteId, quantite: l.quantiteDeposee },
          });
          await tx.mouvementStock.create({
            data: {
              produitId: l.produitId,
              pointDeVenteId: depot.pointDeVenteId,
              type: "ENTREE",
              typeEntree: "DEPOT_VENTE",
              quantite: l.quantiteDeposee,
              motif: `Entrée en dépôt-vente ${depot.reference}`,
              reference: `${depot.reference}-P${l.produitId}-${randomUUID().slice(0, 4).toUpperCase()}`,
              operateurId: userId,
            },
          });
        }

        const d = await tx.depotMarchandise.update({
          where: { id: depotId },
          data: { statut: "EN_STOCK", entreeParId: userId, dateEntree: new Date() },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "DEP_ENTREE_CONSTATEE", "DepotMarchandise", depotId, undefined, getRequestMeta(req));
        await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {
          titre: `Dépôt-vente entré en stock (${depot.reference})`,
          message: `${session.user.prenom} ${session.user.nom} a constaté l'entrée en stock du dépôt ${depot.reference}.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/logistiquesApprovisionnements/depot-vente?depot=${depotId}`,
        });
        return d;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "REPRISE_INVENDUS") {
      if (depot.statut !== "EN_STOCK") {
        return NextResponse.json({ error: "Le dépôt doit être en stock pour reprendre des invendus" }, { status: 422 });
      }
      const reprisesInput = (body.lignes ?? []) as ReprisInput[];
      if (!reprisesInput.length) return NextResponse.json({ error: "Au moins une ligne est requise" }, { status: 400 });

      const lignesParId = new Map(depot.lignes.map((l) => [l.id, l]));
      for (const r of reprisesInput) {
        const ligne = lignesParId.get(Number(r.ligneId));
        if (!ligne) return NextResponse.json({ error: "Ligne de dépôt introuvable" }, { status: 404 });
        if (!ligne.lotProduitId) return NextResponse.json({ error: "Ligne pas encore entrée en stock" }, { status: 422 });
        if (!r.quantite || r.quantite <= 0) return NextResponse.json({ error: "Quantité invalide" }, { status: 400 });
      }

      const lots = await prisma.lotProduit.findMany({
        where: { id: { in: reprisesInput.map((r) => lignesParId.get(Number(r.ligneId))!.lotProduitId!) } },
        select: { id: true, quantite: true },
      });
      const lotParId = new Map(lots.map((l) => [l.id, l]));
      for (const r of reprisesInput) {
        const ligne = lignesParId.get(Number(r.ligneId))!;
        const lot = lotParId.get(ligne.lotProduitId!)!;
        if (Number(r.quantite) > lot.quantite) {
          return NextResponse.json({ error: `Quantité à reprendre (${r.quantite}) supérieure au stock restant du lot (${lot.quantite})` }, { status: 422 });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const lignesBonSortie: { produitId: number; quantite: number }[] = [];
        for (const r of reprisesInput) {
          const ligne = lignesParId.get(Number(r.ligneId))!;
          const quantite = Number(r.quantite);

          await tx.stockSite.update({
            where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: depot.pointDeVenteId } },
            data: { quantite: { decrement: quantite } },
          });
          const lot = await tx.lotProduit.update({
            where: { id: ligne.lotProduitId! },
            data: { quantite: { decrement: quantite } },
            select: { id: true, quantite: true },
          });
          if (lot.quantite === 0) await tx.lotProduit.update({ where: { id: lot.id }, data: { statut: "EPUISE" } });
          await tx.mouvementLot.create({
            data: { lotId: lot.id, type: "SORTIE", quantite, motif: `Reprise invendus — dépôt ${depot.reference}`, operateurId: userId },
          });
          await tx.ligneDepotMarchandise.update({ where: { id: ligne.id }, data: { quantiteReprise: { increment: quantite } } });
          lignesBonSortie.push({ produitId: ligne.produitId, quantite });
        }

        const refBS = `BS-${Date.now()}-DEP${depot.id}`;
        const bonSortie = await tx.bonSortie.create({
          data: {
            reference: refBS,
            typeSortie: "RETOUR_FOURNISSEUR",
            statut: "VALIDE",
            pointDeVenteId: depot.pointDeVenteId,
            motif: `Reprise des invendus — dépôt-vente ${depot.reference}`,
            creeParId: userId,
            valideParId: userId,
            dateValidation: new Date(),
            lignes: { create: lignesBonSortie.map((l) => ({ produitId: l.produitId, quantite: l.quantite, quantiteDemandee: l.quantite })) },
          },
        });
        for (const l of lignesBonSortie) {
          await tx.mouvementStock.create({
            data: {
              produitId: l.produitId,
              pointDeVenteId: depot.pointDeVenteId,
              type: "SORTIE",
              typeSortie: "RETOUR_FOURNISSEUR",
              quantite: l.quantite,
              motif: `Reprise invendus — dépôt ${depot.reference}`,
              reference: `${refBS}-P${l.produitId}-${randomUUID().slice(0, 4).toUpperCase()}`,
              operateurId: userId,
              bonSortieId: bonSortie.id,
            },
          });
        }

        // Clôture auto si tout le dépôt est écoulé (vendu ou repris) : plus rien à suivre.
        const lignesRestantes = await tx.ligneDepotMarchandise.findMany({
          where: { depotId },
          select: { lotProduitId: true },
        });
        const lotsRestants = await tx.lotProduit.findMany({
          where: { id: { in: lignesRestantes.map((l) => l.lotProduitId).filter((id): id is number => id != null) } },
          select: { quantite: true },
        });
        const tousEpuises = lotsRestants.length > 0 && lotsRestants.every((l) => l.quantite === 0);

        const d = await tx.depotMarchandise.update({
          where: { id: depotId },
          data: tousEpuises ? { statut: "CLOTURE" } : {},
          include: INCLUDE,
        });
        await auditLog(tx, userId, "DEP_REPRISE_INVENDUS", "DepotMarchandise", depotId, { bonSortieId: bonSortie.id }, getRequestMeta(req));
        return d;
      });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /logistique/depot-vente/depots/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
