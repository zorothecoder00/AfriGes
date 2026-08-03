// lib/comptabilite/configurationInitiale.ts
//
// Assistant de configuration initiale (CDC §60). Chaque étape est vérifiée en
// interrogeant les données réelles (plan comptable importé ? exercice ouvert ?
// taxe créée ? ...) plutôt que via un indicateur "fait/pas fait" saisi à part,
// qui pourrait diverger de la réalité si l'admin agit directement dans un
// onglet sans repasser par l'assistant.
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export async function chargerConfigurationInitiale(tx: TxClient) {
  const existante = await tx.configurationComptableInitiale.findUnique({ where: { id: 1 } });
  if (existante) return existante;
  return tx.configurationComptableInitiale.create({ data: { id: 1 } });
}

export interface EtapeConfiguration {
  cle: string;
  label: string;
  complete: boolean;
  optionnelle: boolean;
  detail: string;
  onglet: string; // clé de l'onglet à ouvrir dans dashboard/user/comptables
}

export async function calculerEtapesConfiguration(tx: TxClient): Promise<EtapeConfiguration[]> {
  const [nbComptes, nbTresorerie, nbExercices, nbTaxes, nbJournauxPerso, nbAuxiliaires, nbImmobilisations, nbSections] =
    await Promise.all([
      tx.compteComptable.count({ where: { actif: true } }),
      tx.compteComptable.count({ where: { actif: true, type: "TRESORERIE" } }),
      tx.exerciceComptable.count(),
      tx.taxeConfig.count({ where: { actif: true } }),
      tx.journalComptable.count({ where: { actif: true } }),
      tx.compteComptable.count({ where: { OR: [{ clientId: { not: null } }, { fournisseurId: { not: null } }] } }),
      tx.immobilisation.count(),
      tx.sectionAnalytique.count({ where: { actif: true } }),
    ]);

  return [
    {
      cle: "exercice", label: "Exercice comptable", optionnelle: false,
      complete: nbExercices > 0, detail: `${nbExercices} exercice(s)`, onglet: "exercices",
    },
    {
      cle: "planComptable", label: "Plan comptable SYSCOHADA", optionnelle: false,
      complete: nbComptes > 0, detail: `${nbComptes} compte(s) actif(s)`, onglet: "plan",
    },
    {
      cle: "tresorerie", label: "Comptes de trésorerie (banques/caisses)", optionnelle: false,
      complete: nbTresorerie > 0, detail: `${nbTresorerie} compte(s) de trésorerie`, onglet: "plan",
    },
    {
      cle: "auxiliaires", label: "Comptes auxiliaires clients/fournisseurs", optionnelle: true,
      complete: nbAuxiliaires > 0, detail: `${nbAuxiliaires} compte(s) auxiliaire(s)`, onglet: "auxiliaire",
    },
    {
      cle: "taxes", label: "Taxes paramétrées", optionnelle: true,
      complete: nbTaxes > 0, detail: `${nbTaxes} taxe(s) active(s)`, onglet: "exercices",
    },
    {
      cle: "journaux", label: "Journaux", optionnelle: false,
      complete: true, detail: `6 journaux de base${nbJournauxPerso > 0 ? ` + ${nbJournauxPerso} personnalisé(s)` : ""}`, onglet: "exercices",
    },
    {
      cle: "immobilisations", label: "Immobilisations (si applicable)", optionnelle: true,
      complete: nbImmobilisations > 0, detail: `${nbImmobilisations} immobilisation(s)`, onglet: "immobilisations",
    },
    {
      cle: "analytique", label: "Analytique (axes activité/projet/département)", optionnelle: true,
      complete: nbSections > 0, detail: `${nbSections} section(s) analytique(s)`, onglet: "analytique",
    },
  ];
}
