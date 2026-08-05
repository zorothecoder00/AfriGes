// lib/comptabilite/rapportsGestion.ts
//
// Rapports de gestion (CDC Comptabilité §71-72) : au-delà des états OHADA,
// CA par point de vente, marge par produit/famille, rentabilité par agence,
// rotation de stock, DSO clients. Calculés directement depuis les données
// opérationnelles (ventes, crédits, stock) plutôt que depuis les écritures,
// car ce sont des indicateurs de gestion (BI), pas des états comptables
// officiels — cohérent avec le tableau de bord opérationnel déjà existant.
//
// Limite assumée : aucun DPO fournisseurs réel n'est calculable — le schéma
// n'a ni date de facture fournisseur ni date de paiement effectif (seulement
// BonCommande.montantTotal/montantPaye, un état d'avancement, pas un délai).
// Le "proxy" fourni (reste à payer par fournisseur) est clairement étiqueté
// comme tel, jamais présenté comme un DPO au sens strict.
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

interface LigneVenteAgregat {
  pdvId: number;
  produitId: number;
  quantite: number;
  ca: number;
  clientId: number | null;
}

async function collecterLignesVente(tx: TxClient, dateDebut: Date, dateFin: Date): Promise<LigneVenteAgregat[]> {
  const [lignesVD, lignesCredit] = await Promise.all([
    tx.ligneVenteDirecte.findMany({
      where: {
        produitId: { not: null },
        vente: {
          statut: { notIn: ["BROUILLON", "ANNULEE"] },
          modePaiement: { not: "CREDIT" },
          createdAt: { gte: dateDebut, lte: dateFin },
        },
      },
      select: { produitId: true, quantite: true, montant: true, vente: { select: { pointDeVenteId: true, clientId: true } } },
    }),
    tx.ligneCreditClient.findMany({
      where: {
        produitId: { not: null },
        pointDeVenteId: { not: null },
        credit: { statut: { in: ["ACTIF", "EN_RETARD", "SOLDE"] }, dateDebut: { gte: dateDebut, lte: dateFin } },
      },
      select: { produitId: true, quantite: true, montantLigne: true, pointDeVenteId: true, credit: { select: { clientId: true } } },
    }),
  ]);

  const lignes: LigneVenteAgregat[] = [];
  for (const l of lignesVD) {
    if (!l.produitId) continue;
    lignes.push({ pdvId: l.vente.pointDeVenteId, produitId: l.produitId, quantite: l.quantite, ca: Number(l.montant), clientId: l.vente.clientId ?? null });
  }
  for (const l of lignesCredit) {
    if (!l.produitId || !l.pointDeVenteId) continue;
    lignes.push({ pdvId: l.pointDeVenteId, produitId: l.produitId, quantite: l.quantite, ca: Number(l.montantLigne), clientId: l.credit.clientId ?? null });
  }
  return lignes;
}

export interface CaParPdv { pdvId: number; pdvNom: string; caTotal: number }
export interface MargeParProduit {
  produitId: number; nom: string; quantiteVendue: number; ca: number;
  marge: number | null; margePct: number | null; coutConnu: boolean;
}
export interface MargeParFamille { familleId: number | null; nom: string; ca: number; marge: number | null; margePct: number | null }
export interface RentabiliteAgence { pdvId: number; pdvNom: string; ca: number; marge: number | null; margePct: number | null }
export interface RotationStockLigne {
  produitId: number; nom: string; quantiteVendue: number; stockActuel: number;
  rotation: number | null; valeurStock: number;
}
export interface DsoClients { encoursMoyen: number; caCreditPeriode: number; joursPeriode: number; dsoJours: number | null }
export interface DpoFournisseurProxy { fournisseurId: number; nom: string; resteAPayer: number }
export interface RentabiliteClient { clientId: number; clientNom: string; ca: number; marge: number | null; margePct: number | null }
export interface ChargeParAxe { sectionId: number; code: string; libelle: string; montant: number }

export interface RapportsGestion {
  caParPdv: CaParPdv[];
  margeParProduit: MargeParProduit[];
  margeParFamille: MargeParFamille[];
  rentabiliteParAgence: RentabiliteAgence[];
  rentabiliteParClient: RentabiliteClient[];
  rotationStock: RotationStockLigne[];
  dso: DsoClients;
  dpoFournisseursProxy: DpoFournisseurProxy[];
  chargesParDepartement: ChargeParAxe[];
  depensesParProjet: ChargeParAxe[];
}

/**
 * CDC §71 — charges/dépenses par axe analytique Département/Projet. Ces deux
 * axes n'ont pas d'entité métier dédiée (CDC §24) : `SectionAnalytique` les
 * couvre déjà via `axe`, imputée sur `LigneEcriture.sectionAnalytiqueId`. Si
 * le comptable n'a créé aucune section pour cet axe, retourne `[]` (zéro
 * régression, cohérent avec le caractère paramétrable du §76).
 */
export async function chargesParAxeAnalytique(
  tx: TxClient,
  axe: "DEPARTEMENT" | "PROJET",
  dateDebut: Date,
  dateFin: Date,
): Promise<ChargeParAxe[]> {
  const lignes = await tx.ligneEcriture.groupBy({
    by: ["sectionAnalytiqueId"],
    where: {
      sectionAnalytiqueId: { not: null },
      sectionAnalytique: { axe },
      compte: { type: "CHARGES" },
      ecriture: { statut: { in: ["VALIDE", "CLOTURE"] }, date: { gte: dateDebut, lte: dateFin } },
    },
    _sum: { debit: true, credit: true },
  });
  if (lignes.length === 0) return [];

  const sectionIds = lignes.map((l) => l.sectionAnalytiqueId!).filter((id): id is number => id != null);
  const sections = await tx.sectionAnalytique.findMany({ where: { id: { in: sectionIds } }, select: { id: true, code: true, libelle: true } });
  const sectionMap = new Map(sections.map((s) => [s.id, s]));

  return lignes
    .filter((l) => l.sectionAnalytiqueId != null)
    .map((l) => {
      const section = sectionMap.get(l.sectionAnalytiqueId!);
      return {
        sectionId: l.sectionAnalytiqueId!,
        code: section?.code ?? `#${l.sectionAnalytiqueId}`,
        libelle: section?.libelle ?? `Section #${l.sectionAnalytiqueId}`,
        montant: Number(l._sum.debit ?? 0) - Number(l._sum.credit ?? 0),
      };
    })
    .sort((a, b) => b.montant - a.montant);
}

export async function genererRapportsGestion(tx: TxClient, dateDebut: Date, dateFin: Date): Promise<RapportsGestion> {
  const lignes = await collecterLignesVente(tx, dateDebut, dateFin);

  const produitIds = [...new Set(lignes.map((l) => l.produitId))];
  const pdvIds = [...new Set(lignes.map((l) => l.pdvId))];

  const [produits, pdvs] = await Promise.all([
    tx.produit.findMany({
      where: { id: { in: produitIds } },
      select: { id: true, nom: true, prixAchat: true, familleId: true, famille: { select: { nom: true } } },
    }),
    tx.pointDeVente.findMany({ where: { id: { in: pdvIds } }, select: { id: true, nom: true } }),
  ]);
  const produitMap = new Map(produits.map((p) => [p.id, p]));
  const pdvMap = new Map(pdvs.map((p) => [p.id, p.nom]));

  // ── CA par PDV ────────────────────────────────────────────────────────────
  const caPdvAgg = new Map<number, number>();
  for (const l of lignes) caPdvAgg.set(l.pdvId, (caPdvAgg.get(l.pdvId) ?? 0) + l.ca);
  const caParPdv: CaParPdv[] = [...caPdvAgg.entries()]
    .map(([pdvId, caTotal]) => ({ pdvId, pdvNom: pdvMap.get(pdvId) ?? `PDV #${pdvId}`, caTotal }))
    .sort((a, b) => b.caTotal - a.caTotal);

  // ── Marge par produit ─────────────────────────────────────────────────────
  const produitAgg = new Map<number, { quantite: number; ca: number }>();
  for (const l of lignes) {
    const cur = produitAgg.get(l.produitId) ?? { quantite: 0, ca: 0 };
    cur.quantite += l.quantite;
    cur.ca += l.ca;
    produitAgg.set(l.produitId, cur);
  }
  const margeParProduit: MargeParProduit[] = [...produitAgg.entries()].map(([produitId, agg]) => {
    const produit = produitMap.get(produitId);
    const prixAchat = produit?.prixAchat != null ? Number(produit.prixAchat) : null;
    const marge = prixAchat != null ? agg.ca - prixAchat * agg.quantite : null;
    return {
      produitId,
      nom: produit?.nom ?? `Produit #${produitId}`,
      quantiteVendue: agg.quantite,
      ca: agg.ca,
      marge,
      margePct: marge != null && agg.ca > 0 ? Math.round((marge / agg.ca) * 1000) / 10 : null,
      coutConnu: prixAchat != null,
    };
  }).sort((a, b) => b.ca - a.ca);

  // ── Marge par famille ─────────────────────────────────────────────────────
  const familleAgg = new Map<number | null, { nom: string; ca: number; marge: number; margeConnue: boolean }>();
  for (const mp of margeParProduit) {
    const produit = produitMap.get(mp.produitId);
    const familleId = produit?.familleId ?? null;
    const nom = produit?.famille?.nom ?? "Sans famille";
    const cur = familleAgg.get(familleId) ?? { nom, ca: 0, marge: 0, margeConnue: true };
    cur.ca += mp.ca;
    if (mp.marge != null) cur.marge += mp.marge;
    else cur.margeConnue = false;
    familleAgg.set(familleId, cur);
  }
  const margeParFamille: MargeParFamille[] = [...familleAgg.entries()]
    .map(([familleId, agg]) => ({
      familleId, nom: agg.nom, ca: agg.ca,
      marge: agg.margeConnue ? agg.marge : null,
      margePct: agg.margeConnue && agg.ca > 0 ? Math.round((agg.marge / agg.ca) * 1000) / 10 : null,
    }))
    .sort((a, b) => b.ca - a.ca);

  // ── Rentabilité par agence (PDV) ──────────────────────────────────────────
  const agenceAgg = new Map<number, { ca: number; marge: number; margeConnue: boolean }>();
  for (const l of lignes) {
    const produit = produitMap.get(l.produitId);
    const prixAchat = produit?.prixAchat != null ? Number(produit.prixAchat) : null;
    const cur = agenceAgg.get(l.pdvId) ?? { ca: 0, marge: 0, margeConnue: true };
    cur.ca += l.ca;
    if (prixAchat != null) cur.marge += l.ca - prixAchat * l.quantite;
    else cur.margeConnue = false;
    agenceAgg.set(l.pdvId, cur);
  }
  const rentabiliteParAgence: RentabiliteAgence[] = [...agenceAgg.entries()]
    .map(([pdvId, agg]) => ({
      pdvId, pdvNom: pdvMap.get(pdvId) ?? `PDV #${pdvId}`, ca: agg.ca,
      marge: agg.margeConnue ? agg.marge : null,
      margePct: agg.margeConnue && agg.ca > 0 ? Math.round((agg.marge / agg.ca) * 1000) / 10 : null,
    }))
    .sort((a, b) => b.ca - a.ca);

  // ── Rentabilité par client ─────────────────────────────────────────────────
  const clientAgg = new Map<number, { ca: number; marge: number; margeConnue: boolean }>();
  for (const l of lignes) {
    if (l.clientId == null) continue;
    const produit = produitMap.get(l.produitId);
    const prixAchat = produit?.prixAchat != null ? Number(produit.prixAchat) : null;
    const cur = clientAgg.get(l.clientId) ?? { ca: 0, marge: 0, margeConnue: true };
    cur.ca += l.ca;
    if (prixAchat != null) cur.marge += l.ca - prixAchat * l.quantite;
    else cur.margeConnue = false;
    clientAgg.set(l.clientId, cur);
  }
  const clients = await tx.client.findMany({ where: { id: { in: [...clientAgg.keys()] } }, select: { id: true, nom: true, prenom: true } });
  const clientNomMap = new Map(clients.map((c) => [c.id, `${c.prenom} ${c.nom}`]));
  const rentabiliteParClient: RentabiliteClient[] = [...clientAgg.entries()]
    .map(([clientId, agg]) => ({
      clientId, clientNom: clientNomMap.get(clientId) ?? `Client #${clientId}`, ca: agg.ca,
      marge: agg.margeConnue ? agg.marge : null,
      margePct: agg.margeConnue && agg.ca > 0 ? Math.round((agg.marge / agg.ca) * 1000) / 10 : null,
    }))
    .sort((a, b) => b.ca - a.ca);

  // ── Rotation de stock (+ stock immobilisé) ────────────────────────────────
  // Rotation simplifiée = quantité vendue sur la période / stock actuel (comme
  // lib/catalogueStats.ts) — pas une moyenne de stock historique (non tracée).
  const stocks = await tx.stockSite.groupBy({
    by: ["produitId"],
    _sum: { quantite: true },
    where: { quantite: { gt: 0 } },
  });
  const produitsStock = await tx.produit.findMany({
    where: { id: { in: stocks.map((s) => s.produitId) } },
    select: { id: true, nom: true, prixAchat: true, prixUnitaire: true },
  });
  const produitStockMap = new Map(produitsStock.map((p) => [p.id, p]));
  const rotationStock: RotationStockLigne[] = stocks.map((s) => {
    const produit = produitStockMap.get(s.produitId);
    const stockActuel = Number(s._sum.quantite ?? 0);
    const quantiteVendue = produitAgg.get(s.produitId)?.quantite ?? 0;
    const coutUnitaire = produit ? Number(produit.prixAchat ?? produit.prixUnitaire) : 0;
    return {
      produitId: s.produitId,
      nom: produit?.nom ?? `Produit #${s.produitId}`,
      quantiteVendue,
      stockActuel,
      rotation: stockActuel > 0 ? Math.round((quantiteVendue / stockActuel) * 100) / 100 : null,
      valeurStock: stockActuel * coutUnitaire,
    };
  }).sort((a, b) => b.valeurStock - a.valeurStock);

  // ── DSO clients (formule standard : encours moyen / CA crédit × jours période) ─
  const joursPeriode = Math.max(1, Math.round((dateFin.getTime() - dateDebut.getTime()) / 86_400_000));
  const [encoursAgg, caCreditAgg] = await Promise.all([
    tx.creditClient.aggregate({ where: { statut: { in: ["ACTIF", "EN_RETARD"] } }, _sum: { soldeRestant: true } }),
    tx.creditClient.aggregate({
      where: { statut: { in: ["ACTIF", "EN_RETARD", "SOLDE"] }, dateDebut: { gte: dateDebut, lte: dateFin } },
      _sum: { montantTotal: true },
    }),
  ]);
  const encoursMoyen = Number(encoursAgg._sum.soldeRestant ?? 0);
  const caCreditPeriode = Number(caCreditAgg._sum.montantTotal ?? 0);
  const dso: DsoClients = {
    encoursMoyen, caCreditPeriode, joursPeriode,
    dsoJours: caCreditPeriode > 0 ? Math.round((encoursMoyen / caCreditPeriode) * joursPeriode * 10) / 10 : null,
  };

  // ── DPO fournisseurs (proxy — pas un vrai DPO, voir en-tête du fichier) ───
  const bonsCommande = await tx.bonCommande.groupBy({
    by: ["fournisseurId"],
    where: { montantTotal: { gt: 0 } },
    _sum: { montantTotal: true, montantPaye: true },
  });
  const fournisseurIds = bonsCommande.map((b) => b.fournisseurId);
  const fournisseurs = await tx.fournisseur.findMany({ where: { id: { in: fournisseurIds } }, select: { id: true, nom: true } });
  const fournisseurNomMap = new Map(fournisseurs.map((f) => [f.id, f.nom]));
  const dpoFournisseursProxy: DpoFournisseurProxy[] = bonsCommande
    .map((b) => ({
      fournisseurId: b.fournisseurId,
      nom: fournisseurNomMap.get(b.fournisseurId) ?? `Fournisseur #${b.fournisseurId}`,
      resteAPayer: Number(b._sum.montantTotal ?? 0) - Number(b._sum.montantPaye ?? 0),
    }))
    .filter((f) => f.resteAPayer > 0.01)
    .sort((a, b) => b.resteAPayer - a.resteAPayer);

  const [chargesParDepartement, depensesParProjet] = await Promise.all([
    chargesParAxeAnalytique(tx, "DEPARTEMENT", dateDebut, dateFin),
    chargesParAxeAnalytique(tx, "PROJET", dateDebut, dateFin),
  ]);

  return {
    caParPdv, margeParProduit, margeParFamille, rentabiliteParAgence, rentabiliteParClient,
    rotationStock, dso, dpoFournisseursProxy, chargesParDepartement, depensesParProjet,
  };
}
