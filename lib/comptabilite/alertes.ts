// lib/comptabilite/alertes.ts
//
// Module d'alertes à 4 paliers (CDC Comptabilité §73). Avant ce fichier,
// aucune agrégation en paliers visuels n'existait — les signaux bruts
// vivaient séparément dans lib/comptabilite/controles.ts (2 niveaux BLOQUANT/
// ANOMALIE) et assistantCloture.ts. Ce module ne recalcule rien qui existe
// déjà : il recompose les signaux existants (+ FactureAchat, nouveau) en
// 4 paliers 🔴🟠🟡🟢, sans dupliquer leur logique de calcul.
import type { Prisma } from "@prisma/client";
import { verifierPreCloture } from "@/lib/comptabilite/assistantCloture";

type TxClient = Prisma.TransactionClient;

const STATUTS_COMPTABILISES = ["VALIDE", "CLOTURE"] as const;

export interface AlerteItem {
  code: string;
  message: string;
  count?: number;
  montant?: number;
}

export interface AlertesComptables {
  critique: AlerteItem[];
  attention: AlerteItem[];
  aTraiter: AlerteItem[];
  ok: AlerteItem[];
}

/** 🔴 Critique — comptes bancaires (521) au solde négatif (distinct de la caisse, CDC §73 spécifie "compte bancaire"). */
async function alertesCritiques(tx: TxClient): Promise<AlerteItem[]> {
  const comptes = await tx.compteComptable.findMany({
    where: { numero: { startsWith: "521" }, actif: true },
    select: { id: true, numero: true, libelle: true },
  });
  if (comptes.length === 0) return [];

  const soldes = await tx.ligneEcriture.groupBy({
    by: ["compteId"],
    where: { compteId: { in: comptes.map((c) => c.id) }, ecriture: { statut: { in: [...STATUTS_COMPTABILISES] } } },
    _sum: { debit: true, credit: true },
  });
  const compteMap = new Map(comptes.map((c) => [c.id, c]));

  const alertes: AlerteItem[] = [];
  for (const s of soldes) {
    const solde = Number(s._sum.debit ?? 0) - Number(s._sum.credit ?? 0);
    if (solde < -0.01) {
      const compte = compteMap.get(s.compteId);
      alertes.push({
        code: "COMPTE_BANCAIRE_NEGATIF",
        message: `Compte bancaire ${compte?.numero ?? s.compteId} (${compte?.libelle ?? ""}) au solde négatif`,
        montant: solde,
      });
    }
  }
  return alertes;
}

/** 🟠 Attention — factures fournisseurs non rapprochées. */
async function alertesAttention(tx: TxClient): Promise<AlerteItem[]> {
  const count = await tx.factureAchat.count({ where: { statutRapprochement: "NON_RAPPROCHEE" } });
  if (count === 0) return [];
  return [{ code: "FACTURES_FOURNISSEURS_NON_RAPPROCHEES", message: `${count} facture(s) fournisseur(s) non rapprochée(s)`, count }];
}

/** 🟡 À traiter — écritures en attente de validation (BROUILLON). */
async function alertesATraiter(tx: TxClient): Promise<AlerteItem[]> {
  const count = await tx.ecritureComptable.count({ where: { statut: "BROUILLON" } });
  if (count === 0) return [];
  return [{ code: "ECRITURES_EN_ATTENTE_VALIDATION", message: `${count} écriture(s) en attente de validation`, count }];
}

/** 🟢 OK — période prête pour clôture (réutilise l'assistant de clôture, jamais recalculé ici). */
async function alertesOk(tx: TxClient): Promise<{ ok: AlerteItem[]; aTraiterSupplementaire: AlerteItem[] }> {
  const annee = new Date().getFullYear();
  const etat = await verifierPreCloture(tx, annee);
  if (etat.peutCloturer) {
    return { ok: [{ code: "PERIODE_PRETE_CLOTURE", message: `Période ${annee} prête pour clôture` }], aTraiterSupplementaire: [] };
  }
  const bloquants = etat.items.filter((i) => i.bloquant && !i.ok);
  return {
    ok: [],
    aTraiterSupplementaire: bloquants.length > 0
      ? [{ code: "CLOTURE_NON_PRETE", message: `Clôture ${annee} non prête — ${bloquants.length} point(s) bloquant(s)`, count: bloquants.length }]
      : [],
  };
}

export async function genererAlertes(tx: TxClient): Promise<AlertesComptables> {
  const [critique, attention, aTraiter, { ok, aTraiterSupplementaire }] = await Promise.all([
    alertesCritiques(tx),
    alertesAttention(tx),
    alertesATraiter(tx),
    alertesOk(tx),
  ]);
  return { critique, attention, aTraiter: [...aTraiter, ...aTraiterSupplementaire], ok };
}
