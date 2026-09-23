// lib/inventaireServer.ts
//
// Inventaire physique (InventaireSite) — logique serveur partagée entre l'espace
// magasinier/RPV (comptage + soumission) et l'espace admin (validation).
//
// Workflow : EN_COURS (comptage) → SOUMIS (magasinier) → VALIDE (admin, écarts appliqués)
//                                                     ↘ EN_COURS (rejet admin, recomptage)
//
// À la validation, l'écart (constaté − système figé au démarrage) est appliqué en
// DELTA sur le StockSite courant, et non en écrasant la quantité : les mouvements
// survenus entre le démarrage de l'inventaire et sa validation (ventes, réceptions)
// sont ainsi préservés, et le MouvementStock AJUSTEMENT créé reste cohérent avec la
// variation réelle du StockSite (et avec l'écriture comptable de l'écart).
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { notify, notifyRoles, auditLog } from "@/lib/notifications";

type TxClient = Prisma.TransactionClient;

/**
 * PDV de l'utilisateur qui réalise l'inventaire (magasinier via affectation, RPV via rpvId).
 */
export async function getOwnPDV(userId: number): Promise<number | null> {
  const aff = await prisma.gestionnaireAffectation.findFirst({
    where: { userId, actif: true },
    select: { pointDeVenteId: true },
  });
  if (aff?.pointDeVenteId) return aff.pointDeVenteId;

  const pdv = await prisma.pointDeVente.findUnique({
    where: { rpvId: userId },
    select: { id: true },
  });
  return pdv?.id ?? null;
}

export const INCLUDE_DETAIL_INVENTAIRE = {
  pointDeVente: { select: { id: true, nom: true, code: true, type: true } },
  realisePar:   { select: { id: true, nom: true, prenom: true } },
  validePar:    { select: { id: true, nom: true, prenom: true } },
  lignes: {
    orderBy: { produit: { nom: "asc" } },
    include: {
      produit: { select: { id: true, nom: true, reference: true, unite: true, prixUnitaire: true, prixAchat: true } },
    },
  },
} satisfies Prisma.InventaireSiteInclude;

/**
 * Détail d'un inventaire + stats + stock actuel de chaque produit (pour signaler à
 * l'admin les produits dont le stock a bougé depuis le démarrage du comptage).
 */
export async function chargerDetailInventaire(id: number) {
  const inv = await prisma.inventaireSite.findUnique({ where: { id }, include: INCLUDE_DETAIL_INVENTAIRE });
  if (!inv) return null;

  const stocks = await prisma.stockSite.findMany({
    where: { pointDeVenteId: inv.pointDeVenteId, produitId: { in: inv.lignes.map(l => l.produitId) } },
    select: { produitId: true, quantite: true, quantiteReservee: true },
  });
  const stockParProduit = new Map(stocks.map(s => [s.produitId, s]));

  const lignes = inv.lignes.map(l => {
    const s = stockParProduit.get(l.produitId);
    const stockActuel = s?.quantite ?? 0;
    return {
      ...l,
      stockActuel,
      quantiteReservee: s?.quantiteReservee ?? 0,
      // Stock après validation (écart appliqué en delta sur le stock courant)
      stockApresValidation: stockActuel + l.ecart,
    };
  });

  const coutUnitaire = (l: (typeof lignes)[number]) => Number(l.produit.prixAchat ?? l.produit.prixUnitaire);
  const stats = {
    nbLignes:        lignes.length,
    nbEcarts:        lignes.filter(l => l.ecart !== 0).length,
    nbSurplus:       lignes.filter(l => l.ecart > 0).length,
    nbManquants:     lignes.filter(l => l.ecart < 0).length,
    nbStockModifie:  lignes.filter(l => l.stockActuel !== l.quantiteSysteme).length,
    valeurEcart:     lignes.reduce((acc, l) => acc + l.ecart * coutUnitaire(l), 0),
    valeurSurplus:   lignes.filter(l => l.ecart > 0).reduce((acc, l) => acc + l.ecart * coutUnitaire(l), 0),
    valeurManquants: lignes.filter(l => l.ecart < 0).reduce((acc, l) => acc + l.ecart * coutUnitaire(l), 0),
  };

  return { ...inv, lignes, stats };
}

/**
 * Validation admin : applique les écarts au StockSite (delta), crée les
 * MouvementStock d'ajustement, passe l'inventaire en VALIDE et notifie.
 * Lève une Error (message affichable) si l'inventaire n'est pas SOUMIS ou si un
 * écart rendrait un stock négatif / inférieur aux quantités réservées.
 */
export async function validerInventaire(
  tx: TxClient,
  inventaireId: number,
  validateur: { id: number; nom: string },
  commentaire?: string | null,
) {
  const inv = await tx.inventaireSite.findUnique({
    where: { id: inventaireId },
    include: {
      lignes: { include: { produit: { select: { nom: true } } } },
      pointDeVente: { select: { nom: true } },
    },
  });
  if (!inv) throw new Error("Inventaire introuvable");
  if (inv.statut !== "SOUMIS") {
    throw new Error(`Seul un inventaire soumis peut être validé (statut actuel : ${inv.statut})`);
  }

  const lignesEcart = inv.lignes.filter(l => l.ecart !== 0);
  const stocks = await tx.stockSite.findMany({
    where: { pointDeVenteId: inv.pointDeVenteId, produitId: { in: lignesEcart.map(l => l.produitId) } },
  });
  const stockParProduit = new Map(stocks.map(s => [s.produitId, s]));

  const bloquants: string[] = [];
  for (const l of lignesEcart) {
    const s = stockParProduit.get(l.produitId);
    const apres = (s?.quantite ?? 0) + l.ecart;
    if (apres < 0) bloquants.push(`${l.produit.nom} (stock résultant ${apres})`);
    else if (apres < (s?.quantiteReservee ?? 0)) bloquants.push(`${l.produit.nom} (${apres} < ${s?.quantiteReservee} réservé(s))`);
  }
  if (bloquants.length) {
    throw new Error(
      `Validation impossible — le stock a bougé depuis le comptage : ${bloquants.join(", ")}. Rejetez l'inventaire pour un recomptage.`,
    );
  }

  for (const l of lignesEcart) {
    await tx.stockSite.upsert({
      where:  { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: inv.pointDeVenteId } },
      update: { quantite: { increment: l.ecart } },
      create: { produitId: l.produitId, pointDeVenteId: inv.pointDeVenteId, quantite: l.ecart },
    });

    await tx.mouvementStock.create({
      data: {
        produitId:      l.produitId,
        pointDeVenteId: inv.pointDeVenteId,
        type:           "AJUSTEMENT",
        typeEntree:     l.ecart > 0 ? "AJUSTEMENT_POSITIF" : undefined,
        typeSortie:     l.ecart < 0 ? "AJUSTEMENT_NEGATIF" : undefined,
        quantite:       Math.abs(l.ecart),
        motif:          `Ajustement inventaire ${inv.reference} (validé par ${validateur.nom})`,
        reference:      `${inv.reference}-ADJ-P${l.produitId}-${randomUUID().slice(0, 4).toUpperCase()}`,
        operateurId:    validateur.id,
      },
    });
  }

  const valide = await tx.inventaireSite.update({
    where: { id: inventaireId },
    data: {
      statut:                "VALIDE",
      valideParId:           validateur.id,
      dateValidation:        new Date(),
      commentaireValidation: commentaire?.trim() || null,
    },
  });

  await auditLog(tx, validateur.id, "INVENTAIRE_VALIDE", "InventaireSite", inventaireId);

  await notify(tx, [inv.realiseParId], {
    titre:     `Inventaire validé : ${inv.reference}`,
    message:   `${validateur.nom} a validé l'inventaire de "${inv.pointDeVente.nom}". ${lignesEcart.length} écart(s) appliqué(s) au stock.`,
    priorite:  "NORMAL",
    actionUrl: `/dashboard/user/magasiniers/inventaires?detail=${inventaireId}`,
  });

  await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "COMPTABLE"], {
    titre:     `Inventaire validé : ${inv.reference}`,
    message:   `${validateur.nom} a validé l'inventaire de "${inv.pointDeVente.nom}". ${lignesEcart.length} écart(s) appliqué(s) au stock — écart à comptabiliser.`,
    priorite:  "NORMAL",
    actionUrl: `/dashboard/admin/stock/inventaires?detail=${inventaireId}`,
  });

  return valide;
}

/** Rejet admin : l'inventaire repasse EN_COURS pour recomptage, avec motif. */
export async function rejeterInventaire(
  tx: TxClient,
  inventaireId: number,
  validateur: { id: number; nom: string },
  motif: string,
) {
  const inv = await tx.inventaireSite.findUnique({
    where: { id: inventaireId },
    include: { pointDeVente: { select: { nom: true } } },
  });
  if (!inv) throw new Error("Inventaire introuvable");
  if (inv.statut !== "SOUMIS") throw new Error(`Seul un inventaire soumis peut être rejeté (statut actuel : ${inv.statut})`);

  const updated = await tx.inventaireSite.update({
    where: { id: inventaireId },
    data: { statut: "EN_COURS", commentaireValidation: motif.trim(), dateSoumission: null },
  });

  await auditLog(tx, validateur.id, "INVENTAIRE_REJETE", "InventaireSite", inventaireId);
  await notify(tx, [inv.realiseParId], {
    titre:     `Inventaire à recompter : ${inv.reference}`,
    message:   `${validateur.nom} a renvoyé l'inventaire de "${inv.pointDeVente.nom}" pour recomptage. Motif : ${motif.trim()}`,
    priorite:  "HAUTE",
    actionUrl: `/dashboard/user/magasiniers/inventaires?detail=${inventaireId}`,
  });

  return updated;
}
