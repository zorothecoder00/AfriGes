// lib/comptabilite/tva.ts
//
// Branchement réel de TaxeConfig dans le calcul de la TVA (CDC §21 : "ne jamais
// coder les taux fiscaux en dur"). Avant ce fichier, aucune vente ne calculait
// de TVA automatiquement : `montantTVA` restait à 0 partout (FactureVente) et
// seule une déclaration TVA manuelle existait. Si le comptable configure une
// taxe de nature "TVA" (onglet Exercices, Taxes & Récurrentes), les écritures de
// vente générées automatiquement (comptant et crédit) la décomposent désormais
// HT/TVA ; sans configuration, le comportement reste identique à avant (montant
// total imputé en Ventes, aucune TVA) — zéro régression.
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export interface TvaActive {
  taux: number;
  compteCollecteNumero: string;
}

/** Taxe TVA active applicable aux ventes — la première par ordre de création si plusieurs (cas rare). */
export async function resoudreTvaVente(tx: TxClient): Promise<TvaActive | null> {
  const taxe = await tx.taxeConfig.findFirst({
    where: { nature: "TVA", actif: true, applicableVente: true },
    orderBy: { id: "asc" },
  });
  if (!taxe) return null;
  return { taux: Number(taxe.taux), compteCollecteNumero: taxe.compteCollecteNumero };
}

export interface TvaAchatActive {
  taux: number;
  compteDeductibleNumero: string;
}

/**
 * Contexte optionnel (CDC §65 tax_rules) permettant de résoudre un taux réduit
 * conditionnel par catégorie/famille/PDV, à l'image de `RegleComptable`. Omis
 * ou `{}` = comportement historique inchangé (première taxe TVA active, sans
 * condition). Non branché côté ventes (§64 précédent — les ventes restent sur
 * un taux global, décision assumée pour ne pas refactoriser la génération
 * d'écriture de vente en ligne-par-ligne).
 */
export interface ContexteTaxe {
  categorieId?: number | null;
  familleId?: number | null;
  pointDeVenteId?: number | null;
}

/**
 * Taxe TVA active applicable aux achats (CDC §21 — "applicable à achat") :
 * avant cette fonction, `TaxeConfig.applicableAchat` était stocké mais jamais
 * lu par le moteur d'écriture d'achat, qui imputait tout le montant TTC en
 * charge/stock sans jamais isoler la TVA déductible (4432).
 *
 * CDC §65 (tax_rules) : si `ctx` est fourni, les taxes candidates sont
 * filtrées par leurs conditions (catégorie/famille/PDV — une condition non
 * renseignée sur la taxe matche tout) puis triées par `priorite` décroissante,
 * la première qui matche toutes ses conditions renseignées l'emporte — même
 * principe que `resoudreRegleComptable` (moteur.ts).
 */
export async function resoudreTvaAchat(tx: TxClient, ctx: ContexteTaxe = {}): Promise<TvaAchatActive | null> {
  const taxes = await tx.taxeConfig.findMany({
    where: { nature: "TVA", actif: true, applicableAchat: true },
    orderBy: { priorite: "desc" },
  });
  for (const taxe of taxes) {
    if (taxe.conditionCategorieId != null && taxe.conditionCategorieId !== ctx.categorieId) continue;
    if (taxe.conditionFamilleId != null && taxe.conditionFamilleId !== ctx.familleId) continue;
    if (taxe.conditionPointDeVenteId != null && taxe.conditionPointDeVenteId !== ctx.pointDeVenteId) continue;
    // compteDeductibleNumero est nullable en base (une taxe peut n'être configurée
    // que côté vente) — sans compte déductible, impossible de décomposer la TVA
    // sur achat, comportement identique à "aucune taxe applicable".
    if (!taxe.compteDeductibleNumero) continue;
    return { taux: Number(taxe.taux), compteDeductibleNumero: taxe.compteDeductibleNumero };
  }
  return null;
}

/** Décompose un montant TTC en HT + TVA selon un taux (%). */
export function decomposerTTC(montantTTC: number, tauxPct: number): { montantHT: number; montantTVA: number } {
  const montantHT = montantTTC / (1 + tauxPct / 100);
  const montantTVA = montantTTC - montantHT;
  return { montantHT: Math.round(montantHT * 100) / 100, montantTVA: Math.round(montantTVA * 100) / 100 };
}
