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

  // Taxes/TVA : TVA collectée/déductible réellement due sur le dernier mois de
  // l'exercice, non encore déclarée (DeclarationTVA absente ou BROUILLON) — avant
  // cette version, l'item ne vérifiait qu'un nombre de taxes actives, jamais un
  // montant dû, et affichait toujours ok:true quel que soit l'état réel.
  const dernierMois = `${annee}-12`;
  const declarationDecembre = await tx.declarationTVA.findUnique({ where: { periode: dernierMois } });
  items.push({
    cle: "taxes",
    label: "Taxes / TVA",
    ok: !!declarationDecembre && declarationDecembre.statut === "VALIDE",
    bloquant: false,
    detail: !declarationDecembre
      ? `Déclaration TVA ${dernierMois} non enregistrée`
      : declarationDecembre.statut !== "VALIDE"
        ? `Déclaration TVA ${dernierMois} en brouillon, non validée`
        : "À jour",
  });

  // Stocks — inventaires validés dont l'écart n'a pas encore été comptabilisé (CDC §23/§30).
  const nbInventairesNonComptabilises = await tx.inventaireSite.count({ where: { statut: "VALIDE", ecritureRegularisationId: null } });
  items.push({
    cle: "stocks",
    label: "Stocks",
    ok: nbInventairesNonComptabilises === 0,
    bloquant: false,
    detail: nbInventairesNonComptabilises === 0 ? "Aucun inventaire en attente" : `${nbInventairesNonComptabilises} inventaire(s) validé(s) non comptabilisé(s)`,
  });

  // Écritures de régularisation (CCA/PCA) dont une échéance de l'exercice n'est pas encore comptabilisée.
  const nbEcheancesRegulEnAttente = await tx.echeanceRegularisation.count({
    where: { comptabilise: false, periode: { lte: `${annee}-12` }, regularisation: { statut: "ACTIVE" } },
  });
  items.push({
    cle: "regularisations",
    label: "Écritures de régularisation",
    ok: nbEcheancesRegulEnAttente === 0,
    bloquant: false,
    detail: nbEcheancesRegulEnAttente === 0 ? "Aucune échéance en attente" : `${nbEcheancesRegulEnAttente} échéance(s) CCA/PCA non comptabilisée(s)`,
  });

  // Caisse, clients, fournisseurs — nommés individuellement (CDC §30 les liste
  // séparément) plutôt que noyés dans le fourre-tout "controles_anomalies".
  const nbCaisseNegative = constats.filter((c) => c.code === "SOLDE_TRESORERIE_NEGATIF").length;
  items.push({
    cle: "caisse",
    label: "Caisse",
    ok: nbCaisseNegative === 0,
    bloquant: false,
    detail: nbCaisseNegative === 0 ? "Aucun solde négatif" : `${nbCaisseNegative} compte(s) de trésorerie en solde négatif`,
  });
  const nbClientsInhabituels = constats.filter((c) => c.code === "CLIENT_CREDITEUR_INHABITUEL").length;
  items.push({
    cle: "clients",
    label: "Clients",
    ok: nbClientsInhabituels === 0,
    bloquant: false,
    detail: nbClientsInhabituels === 0 ? "Aucune anomalie" : `${nbClientsInhabituels} client(s) créditeur(s) inhabituel(s)`,
  });
  const nbFournisseursAnomalies = constats.filter((c) => c.code === "FOURNISSEUR_DEBITEUR_INHABITUEL" || c.code === "PAIEMENT_SANS_FACTURE").length;
  const nbFacturesFournisseursImpayees = constats.filter((c) => c.code === "FACTURE_SANS_PAIEMENT").length;
  items.push({
    cle: "fournisseurs",
    label: "Fournisseurs / factures impayées",
    ok: nbFournisseursAnomalies === 0 && nbFacturesFournisseursImpayees === 0,
    bloquant: false,
    detail: nbFournisseursAnomalies === 0 && nbFacturesFournisseursImpayees === 0
      ? "Aucune anomalie"
      : `${nbFournisseursAnomalies} anomalie(s) fournisseur · ${nbFacturesFournisseursImpayees} facture(s) impayée(s)`,
  });

  // Résultat prévisionnel (aperçu, sans rien clôturer).
  const { resultatNet } = await genererCompteResultat(tx, dateDebut, dateFin);

  const peutCloturer = items.filter((i) => i.bloquant).every((i) => i.ok);
  return { items, peutCloturer, resultatNetPrevisionnel: resultatNet };
}
