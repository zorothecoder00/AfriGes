// lib/comptabilite/configurationInitiale.ts
//
// Assistant de configuration initiale (CDC §60). Chaque étape est vérifiée en
// interrogeant les données réelles (plan comptable importé ? exercice ouvert ?
// taxe créée ? ...) plutôt que via un indicateur "fait/pas fait" saisi à part,
// qui pourrait diverger de la réalité si l'admin agit directement dans un
// onglet sans repasser par l'assistant.
import type { Prisma } from "@prisma/client";
import { verifierPreCloture } from "@/lib/comptabilite/assistantCloture";

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
  const [
    config, nbComptes, nbBanques, nbCaisses, nbExercices, nbTaxes, nbJournauxPerso,
    nbComptesClients, nbComptesFournisseurs, nbImmobilisations, nbSections,
  ] = await Promise.all([
    chargerConfigurationInitiale(tx),
    tx.compteComptable.count({ where: { actif: true } }),
    tx.compteComptable.count({ where: { actif: true, type: "TRESORERIE", numero: { startsWith: "52" } } }),
    tx.compteComptable.count({ where: { actif: true, type: "TRESORERIE", numero: { startsWith: "57" } } }),
    tx.exerciceComptable.count(),
    tx.taxeConfig.count({ where: { actif: true } }),
    tx.journalComptable.count({ where: { actif: true } }),
    tx.compteComptable.count({ where: { clientId: { not: null } } }),
    tx.compteComptable.count({ where: { fournisseurId: { not: null } } }),
    tx.immobilisation.count(),
    tx.sectionAnalytique.count({ where: { actif: true } }),
  ]);

  const exerciceOuvert = await tx.exerciceComptable.findFirst({
    where: { statut: { not: "CLOTURE" } },
    orderBy: { annee: "desc" },
    select: { annee: true },
  });
  let clotureOk = false;
  let clotureDetail = "Aucun exercice ouvert";
  if (exerciceOuvert) {
    const etat = await verifierPreCloture(tx, exerciceOuvert.annee);
    clotureOk = etat.peutCloturer;
    clotureDetail = etat.peutCloturer
      ? `Exercice ${exerciceOuvert.annee} prêt pour clôture`
      : `Exercice ${exerciceOuvert.annee} : ${etat.items.filter((i) => i.bloquant && !i.ok).length} point(s) bloquant(s)`;
  }

  return [
    {
      cle: "pays", label: "Pays", optionnelle: false,
      complete: true, detail: config.pays, onglet: "identite",
    },
    {
      cle: "devise", label: "Devise", optionnelle: false,
      complete: true, detail: config.devise, onglet: "identite",
    },
    {
      cle: "referentiel", label: "Référentiel comptable", optionnelle: false,
      complete: true, detail: config.referentiel, onglet: "identite",
    },
    {
      cle: "exercice", label: "Exercice comptable", optionnelle: false,
      complete: nbExercices > 0, detail: `${nbExercices} exercice(s)`, onglet: "exercices",
    },
    {
      cle: "planComptable", label: "Plan comptable SYSCOHADA", optionnelle: false,
      complete: nbComptes > 0, detail: `${nbComptes} compte(s) actif(s)`, onglet: "plan",
    },
    {
      cle: "taxes", label: "Taxes", optionnelle: true,
      complete: nbTaxes > 0, detail: `${nbTaxes} taxe(s) active(s)`, onglet: "exercices",
    },
    {
      cle: "journaux", label: "Journaux", optionnelle: false,
      complete: true, detail: `6 journaux de base${nbJournauxPerso > 0 ? ` + ${nbJournauxPerso} personnalisé(s)` : ""}`, onglet: "exercices",
    },
    {
      cle: "banques", label: "Banques", optionnelle: false,
      complete: nbBanques > 0, detail: `${nbBanques} compte(s) bancaire(s)`, onglet: "plan",
    },
    {
      cle: "caisses", label: "Caisses", optionnelle: false,
      complete: nbCaisses > 0, detail: `${nbCaisses} caisse(s)`, onglet: "plan",
    },
    {
      cle: "comptesClients", label: "Comptes clients", optionnelle: true,
      complete: nbComptesClients > 0, detail: `${nbComptesClients} compte(s) client`, onglet: "auxiliaire",
    },
    {
      cle: "comptesFournisseurs", label: "Comptes fournisseurs", optionnelle: true,
      complete: nbComptesFournisseurs > 0, detail: `${nbComptesFournisseurs} compte(s) fournisseur`, onglet: "auxiliaire",
    },
    {
      cle: "immobilisations", label: "Immobilisations (si applicable)", optionnelle: true,
      complete: nbImmobilisations > 0, detail: `${nbImmobilisations} immobilisation(s)`, onglet: "immobilisations",
    },
    {
      cle: "analytique", label: "Analytique (axes activité/projet/département)", optionnelle: true,
      complete: nbSections > 0, detail: `${nbSections} section(s) analytique(s)`, onglet: "analytique",
    },
    {
      cle: "cloture", label: "Paramètres de clôture", optionnelle: true,
      complete: clotureOk, detail: clotureDetail, onglet: "cloture",
    },
  ];
}
