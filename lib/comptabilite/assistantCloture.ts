// lib/comptabilite/assistantCloture.ts
//
// Assistant de clôture (CDC §30) : avant de lancer la clôture définitive
// (lib/comptabilite/exercice.ts::cloturerExercice), présente un état des lieux
// complet — écritures non validées, contrôles de cohérence (§40), rapprochements
// bancaires en attente, immobilisations, TVA, résultat prévisionnel — pour que
// le comptable sache À L'AVANCE ce qui bloquera ou non la clôture, plutôt que de
// le découvrir après coup via un rejet 422. Ne modifie jamais rien (dry-run pur).
import type { Prisma } from "@prisma/client";
import { executerControles } from "@/lib/comptabilite/controles";
import { genererCompteResultat } from "@/lib/comptabilite/etatsFinanciers";

type TxClient = Prisma.TransactionClient;

export interface ItemPreCloture {
  cle: string;
  label: string;
  ok: boolean;
  bloquant: boolean;
  detail: string;
}

export interface EtatPreCloture {
  items: ItemPreCloture[];
  peutCloturer: boolean;
  resultatNetPrevisionnel: number;
}

export async function verifierPreCloture(tx: TxClient, annee: number): Promise<EtatPreCloture> {
  const dateDebut = new Date(annee, 0, 1);
  const dateFin = new Date(annee, 11, 31, 23, 59, 59, 999);
  const items: ItemPreCloture[] = [];

  const exercice = await tx.exerciceComptable.findUnique({ where: { annee } });
  items.push({
    cle: "exercice_statut",
    label: "Statut de l'exercice",
    ok: !!exercice && exercice.statut !== "CLOTURE",
    bloquant: true,
    detail: !exercice ? "Exercice non ouvert" : exercice.statut === "CLOTURE" ? "Déjà clôturé" : `Ouvert (${exercice.statut})`,
  });

  // CDC §40 — mêmes contrôles que ceux qui bloqueraient réellement la clôture.
  const constats = await executerControles(tx);
  const bloquants = constats.filter((c) => c.gravite === "BLOQUANT");
  const anomalies = constats.filter((c) => c.gravite === "ANOMALIE");
  items.push({
    cle: "controles_bloquants",
    label: "Contrôles de cohérence bloquants",
    ok: bloquants.length === 0,
    bloquant: true,
    detail: bloquants.length === 0 ? "Aucune anomalie bloquante" : bloquants.map((b) => b.message).slice(0, 5).join(" ; "),
  });
  items.push({
    cle: "controles_anomalies",
    label: "Anomalies signalées (non bloquantes)",
    ok: anomalies.length === 0,
    bloquant: false,
    detail: anomalies.length === 0 ? "Aucune" : `${anomalies.length} anomalie(s) — voir l'onglet Contrôles`,
  });

  // Écritures encore en attente de validation sur la période de l'exercice.
  const nbNonValidees = await tx.ecritureComptable.count({
    where: { statut: { in: ["BROUILLON", "A_CONTROLER"] }, date: { gte: dateDebut, lte: dateFin } },
  });
  items.push({
    cle: "ecritures_non_validees",
    label: "Écritures non validées",
    ok: nbNonValidees === 0,
    bloquant: false,
    detail: nbNonValidees === 0 ? "Aucune" : `${nbNonValidees} écriture(s) en brouillon/à contrôler — n'entreront pas dans le résultat clôturé`,
  });

  // Rapprochements bancaires en attente (CDC §19/§30).
  const nbNonRapproches = await tx.ligneReleveBancaire.count({ where: { statut: "NON_RAPPROCHE" } });
  items.push({
    cle: "rapprochements",
    label: "Rapprochements bancaires en attente",
    ok: nbNonRapproches === 0,
    bloquant: false,
    detail: nbNonRapproches === 0 ? "Aucun" : `${nbNonRapproches} ligne(s) de relevé non rapprochée(s)`,
  });

  // Créances clients échues (impayés) — informatif, ne bloque pas la clôture.
  const nbEcheancesRetard = await tx.echeanceCredit.count({
    where: { dateEcheance: { lt: new Date() }, statut: { in: ["EN_ATTENTE", "PARTIEL"] } },
  });
  items.push({
    cle: "creances_echues",
    label: "Créances clients échues",
    ok: nbEcheancesRetard === 0,
    bloquant: false,
    detail: nbEcheancesRetard === 0 ? "Aucune" : `${nbEcheancesRetard} échéance(s) en retard`,
  });

  // Immobilisations en service sans dotation récente — déjà dans `constats`
  // (controlerImmobilisationsSansAmortissement), repris ici nommément pour la
  // check-list CDC §30 ("immobilisations", "amortissements").
  const nbImmoSansDotation = constats.filter((c) => c.code === "IMMOBILISATION_SANS_AMORTISSEMENT").length;
  items.push({
    cle: "immobilisations",
    label: "Immobilisations / amortissements",
    ok: nbImmoSansDotation === 0,
    bloquant: false,
    detail: nbImmoSansDotation === 0 ? "À jour" : `${nbImmoSansDotation} immobilisation(s) sans dotation récente`,
  });

  // Taxes/TVA paramétrées (informatif — l'absence de taxe active est un choix valide).
  const nbTaxesActives = await tx.taxeConfig.count({ where: { actif: true } });
  items.push({
    cle: "taxes",
    label: "Taxes / TVA",
    ok: true,
    bloquant: false,
    detail: nbTaxesActives > 0 ? `${nbTaxesActives} taxe(s) active(s)` : "Aucune taxe configurée",
  });

  // Résultat prévisionnel (aperçu, sans rien clôturer).
  const { resultatNet } = await genererCompteResultat(tx, dateDebut, dateFin);

  const peutCloturer = items.filter((i) => i.bloquant).every((i) => i.ok);
  return { items, peutCloturer, resultatNetPrevisionnel: resultatNet };
}
