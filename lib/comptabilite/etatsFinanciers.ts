// lib/comptabilite/etatsFinanciers.ts
//
// États financiers calculés EXCLUSIVEMENT depuis les écritures comptables
// validées/clôturées (CDC §36-39) — jamais depuis les modules opérationnels
// (ventes, stock, caisse) directement. C'est le point que le CDC dénonce
// explicitement en §75 ("Générer un bilan avec des valeurs saisies
// manuellement... faire dépendre la comptabilité uniquement du module
// facturation"). Le tableau de bord opérationnel existant
// (/api/comptable/etats-financiers) reste utile comme aperçu rapide des flux
// métier ; celui-ci est la version comptable officielle, traçable jusqu'à
// l'écriture.
import type { Prisma } from "@prisma/client";
import { genererBalanceAgee } from "@/lib/comptabilite/balanceAgee";

type TxClient = Prisma.TransactionClient;

export interface LigneEtatFinancier { compteNumero: string; libelle: string; montant: number }

interface CompteSolde {
  numero: string; libelle: string; classe: number; type: string; sens: string; solde: number;
}

/** Solde de chaque compte actif, dans son sens naturel, sur [dateDebut, dateFin] (dateDebut=null → cumulé depuis toujours). */
async function soldesParCompte(tx: TxClient, dateDebut: Date | null, dateFin: Date): Promise<Map<number, CompteSolde>> {
  const comptes = await tx.compteComptable.findMany({
    where: { actif: true },
    select: { id: true, numero: true, libelle: true, classe: true, type: true, sens: true },
  });
  const lignes = await tx.ligneEcriture.groupBy({
    by: ["compteId"],
    where: {
      ecriture: {
        statut: { in: ["VALIDE", "CLOTURE"] },
        date: { ...(dateDebut ? { gte: dateDebut } : {}), lte: dateFin },
      },
    },
    _sum: { debit: true, credit: true },
  });
  const mouvements = new Map(lignes.map((l) => [l.compteId, { debit: Number(l._sum.debit ?? 0), credit: Number(l._sum.credit ?? 0) }]));

  const result = new Map<number, CompteSolde>();
  for (const c of comptes) {
    const m = mouvements.get(c.id) ?? { debit: 0, credit: 0 };
    const solde = c.sens === "CREDITEUR" ? m.credit - m.debit : m.debit - m.credit;
    result.set(c.id, { numero: c.numero, libelle: c.libelle, classe: c.classe, type: c.type, sens: c.sens, solde });
  }
  return result;
}

/**
 * Bilan (Actif/Passif) au `dateFin`, entièrement dérivé des soldes de comptes
 * (CDC §36 — "jamais rempli manuellement"). Un compte dont le solde est de signe
 * inverse à sa nature bascule automatiquement de l'autre côté du bilan.
 *
 * Comptes de charges/produits (CDC §4 — "résultat provisoire") : ceux d'un
 * exercice déjà clôturé sont absorbés dans 131/132 par l'écriture de clôture
 * (lib/comptabilite/exercice.ts) et n'apparaissent donc jamais ici directement.
 * Mais tant qu'un exercice n'est PAS clôturé, ses charges/produits restent "en
 * l'air" — sans ce résultat provisoire, le bilan ne s'équilibrerait que si TOUS
 * les exercices passés avaient déjà été clôturés, ce qui n'est jamais vrai en
 * pratique (l'exercice en cours ne l'est jamais). On calcule donc le résultat
 * net de tous les mouvements CHARGES/PRODUITS non encore absorbés et on l'ajoute
 * comme une ligne "Résultat provisoire (non clôturé)", exactement comme le
 * ferait un vrai résultat de clôture — le bilan s'équilibre alors toujours,
 * par construction de la partie double.
 */
export async function genererBilan(tx: TxClient, dateFin: Date) {
  const soldes = await soldesParCompte(tx, null, dateFin);
  const actif: LigneEtatFinancier[] = [];
  const passif: LigneEtatFinancier[] = [];
  let resultatProvisoire = 0;

  for (const c of soldes.values()) {
    if (Math.abs(c.solde) < 0.01) continue;
    if (c.type === "ACTIF" || c.type === "TRESORERIE") {
      if (c.solde > 0) actif.push({ compteNumero: c.numero, libelle: c.libelle, montant: c.solde });
      else passif.push({ compteNumero: c.numero, libelle: c.libelle, montant: -c.solde });
    } else if (c.type === "PASSIF") {
      if (c.solde > 0) passif.push({ compteNumero: c.numero, libelle: c.libelle, montant: c.solde });
      else actif.push({ compteNumero: c.numero, libelle: c.libelle, montant: -c.solde });
    } else if (c.type === "PRODUITS") {
      resultatProvisoire += c.solde; // sens CREDITEUR : solde positif = produit
    } else if (c.type === "CHARGES") {
      resultatProvisoire -= c.solde; // sens DEBITEUR : solde positif = charge
    }
  }

  if (Math.abs(resultatProvisoire) >= 0.01) {
    if (resultatProvisoire > 0) passif.push({ compteNumero: "RP", libelle: "Résultat provisoire (non clôturé)", montant: resultatProvisoire });
    else actif.push({ compteNumero: "RP", libelle: "Résultat provisoire (perte, non clôturé)", montant: -resultatProvisoire });
  }

  const totalActif = actif.reduce((s, l) => s + l.montant, 0);
  const totalPassif = passif.reduce((s, l) => s + l.montant, 0);
  return {
    actif: actif.sort((a, b) => a.compteNumero.localeCompare(b.compteNumero)),
    passif: passif.sort((a, b) => a.compteNumero.localeCompare(b.compteNumero)),
    totalActif, totalPassif, equilibre: Math.abs(totalActif - totalPassif) < 1,
  };
}

/** Compte de résultat (Produits/Charges) sur [dateDebut, dateFin] (CDC §37). */
export async function genererCompteResultat(tx: TxClient, dateDebut: Date, dateFin: Date) {
  const soldes = await soldesParCompte(tx, dateDebut, dateFin);
  const produits: LigneEtatFinancier[] = [];
  const charges: LigneEtatFinancier[] = [];

  for (const c of soldes.values()) {
    if (Math.abs(c.solde) < 0.01) continue;
    if (c.type === "PRODUITS") produits.push({ compteNumero: c.numero, libelle: c.libelle, montant: c.solde });
    if (c.type === "CHARGES") charges.push({ compteNumero: c.numero, libelle: c.libelle, montant: c.solde });
  }

  const totalProduits = produits.reduce((s, l) => s + l.montant, 0);
  const totalCharges = charges.reduce((s, l) => s + l.montant, 0);
  return {
    produits: produits.sort((a, b) => a.compteNumero.localeCompare(b.compteNumero)),
    charges: charges.sort((a, b) => a.compteNumero.localeCompare(b.compteNumero)),
    totalProduits, totalCharges, resultatNet: totalProduits - totalCharges,
  };
}

// Regroupement des comptes de charges/produits par préfixe SYSCOHADA à 2
// chiffres, pour reconstituer les niveaux de résultat intermédiaires (CDC §37)
// — exhaustif sur les classes 6/7/8 telles que livrées dans le plan comptable
// (lib/... plan-comptable/route.ts) : chaque préfixe rencontré y tombe dans
// exactement un des 4 paniers ci-dessous (aucun chevauchement).
const PREFIXES_EXPLOITATION_CHARGES = ["60", "61", "62", "63", "64", "65", "66", "68"];
const PREFIXES_EXPLOITATION_PRODUITS = ["70", "71", "72", "73", "75", "78", "79"];
const PREFIXES_FINANCIER_CHARGES = ["67", "69"];
const PREFIXES_FINANCIER_PRODUITS = ["77"];
const PREFIXES_HAO_CHARGES = ["81", "83", "85", "87"];
const PREFIXES_HAO_PRODUITS = ["82", "84", "86", "88"];
const PREFIXES_IMPOTS_RESULTAT = ["89"];

function sommePrefixes(lignes: LigneEtatFinancier[], prefixes: string[]): number {
  return lignes.filter((l) => prefixes.includes(l.compteNumero.slice(0, 2))).reduce((s, l) => s + l.montant, 0);
}

/**
 * Compte de résultat détaillé par niveaux SYSCOHADA (CDC §37) : résultat
 * d'exploitation, résultat financier (→ résultat des activités ordinaires),
 * résultat HAO, impôts sur le résultat, résultat net — reconstitués depuis
 * `genererCompteResultat` par préfixe de compte, sans dupliquer la lecture
 * des écritures.
 */
export async function genererCompteResultatDetaille(tx: TxClient, dateDebut: Date, dateFin: Date) {
  const { produits, charges, totalProduits, totalCharges } = await genererCompteResultat(tx, dateDebut, dateFin);

  const chargesExploitation = sommePrefixes(charges, PREFIXES_EXPLOITATION_CHARGES);
  const produitsExploitation = sommePrefixes(produits, PREFIXES_EXPLOITATION_PRODUITS);
  const chargesFinancier = sommePrefixes(charges, PREFIXES_FINANCIER_CHARGES);
  const produitsFinancier = sommePrefixes(produits, PREFIXES_FINANCIER_PRODUITS);
  const chargesHAO = sommePrefixes(charges, PREFIXES_HAO_CHARGES);
  const produitsHAO = sommePrefixes(produits, PREFIXES_HAO_PRODUITS);
  const impotsSurResultat = sommePrefixes(charges, PREFIXES_IMPOTS_RESULTAT);

  const resultatExploitation = produitsExploitation - chargesExploitation;
  const resultatFinancier = produitsFinancier - chargesFinancier;
  const resultatActivitesOrdinaires = resultatExploitation + resultatFinancier;
  const resultatHAO = produitsHAO - chargesHAO;
  const resultatNet = resultatActivitesOrdinaires + resultatHAO - impotsSurResultat;

  return {
    produits, charges, totalProduits, totalCharges,
    exploitation: { produits: produitsExploitation, charges: chargesExploitation, resultat: resultatExploitation },
    financier: { produits: produitsFinancier, charges: chargesFinancier, resultat: resultatFinancier },
    resultatActivitesOrdinaires,
    hao: { produits: produitsHAO, charges: chargesHAO, resultat: resultatHAO },
    impotsSurResultat,
    resultatNet,
  };
}

/**
 * Tableau des flux de trésorerie simplifié (CDC §38) : mouvements nets des
 * comptes de trésorerie (classe 5) sur la période, ventilés par journal
 * d'origine. Une méthode indirecte complète (retraitement par masse
 * exploitation/investissement/financement) reste un développement futur ;
 * ceci reste entièrement dérivé des écritures, pas d'un module opérationnel.
 */
export async function genererTableauFlux(tx: TxClient, dateDebut: Date, dateFin: Date) {
  const lignesTresorerie = await tx.ligneEcriture.findMany({
    where: {
      compte: { type: "TRESORERIE" },
      ecriture: { statut: { in: ["VALIDE", "CLOTURE"] }, date: { gte: dateDebut, lte: dateFin } },
    },
    include: { ecriture: { select: { journal: true } } },
  });

  let encaissements = 0;
  let decaissements = 0;
  const parJournal: Record<string, number> = {};
  for (const l of lignesTresorerie) {
    const net = Number(l.debit) - Number(l.credit);
    if (net > 0) encaissements += net; else decaissements += -net;
    parJournal[l.ecriture.journal] = (parJournal[l.ecriture.journal] ?? 0) + net;
  }
  return { encaissements, decaissements, fluxNet: encaissements - decaissements, parJournal };
}

/**
 * Notes annexes (CDC §39) : jeu de notes structurées, toutes dérivées des
 * écritures/immobilisations/provisions/régularisations — jamais saisies à la main.
 * `dateDebut` sert à ventiler les mouvements de la période (immobilisations,
 * provisions, variation des capitaux propres) ; `dateFin` reste la date de
 * situation pour les soldes et échéanciers (créances/dettes).
 */
export async function genererNotesAnnexes(tx: TxClient, dateDebut: Date, dateFin: Date) {
  const soldes = await soldesParCompte(tx, null, dateFin);
  const sumClasse = (classe: number) =>
    [...soldes.values()].filter((c) => c.classe === classe).reduce((s, c) => s + Math.abs(c.solde), 0);
  const sumPrefixe = (prefixe: string) =>
    [...soldes.values()].filter((c) => c.numero.startsWith(prefixe)).reduce((s, c) => s + Math.max(0, c.solde), 0);

  // Immobilisations par catégorie, avec mouvements de la période (CDC §22/§39).
  const immobilisations = await tx.immobilisation.findMany({
    select: {
      categorie: true, coutAcquisition: true, amortissementCumule: true, valeurNetteComptable: true,
      dateAcquisition: true, dateCession: true, statut: true,
    },
  });
  type MouvementCategorie = { brutDebut: number; acquisitionsPeriode: number; cessionsPeriode: number; brutFin: number; amortissementCumule: number; net: number };
  const parCategorie = new Map<string, MouvementCategorie>();
  for (const immo of immobilisations) {
    const cat = immo.categorie;
    if (!parCategorie.has(cat)) parCategorie.set(cat, { brutDebut: 0, acquisitionsPeriode: 0, cessionsPeriode: 0, brutFin: 0, amortissementCumule: 0, net: 0 });
    const entry = parCategorie.get(cat)!;
    const cout = Number(immo.coutAcquisition);
    if (immo.dateAcquisition < dateDebut) entry.brutDebut += cout;
    else if (immo.dateAcquisition <= dateFin) entry.acquisitionsPeriode += cout;
    if (immo.dateCession && immo.dateCession >= dateDebut && immo.dateCession <= dateFin) entry.cessionsPeriode += cout;
    const detenueADateFin = immo.statut !== "CEDEE" || (immo.dateCession != null && immo.dateCession > dateFin);
    if (detenueADateFin) {
      entry.brutFin += cout;
      entry.amortissementCumule += Number(immo.amortissementCumule);
      entry.net += Number(immo.valeurNetteComptable);
    }
  }

  // Échéancier créances/dettes par tranche d'ancienneté (réutilise la balance âgée CDC §16-17).
  const [balanceClients, balanceFournisseurs] = await Promise.all([
    genererBalanceAgee(tx, "CLIENT", dateFin),
    genererBalanceAgee(tx, "FOURNISSEUR", dateFin),
  ]);

  // Mouvements de provisions/dépréciations de la période, groupés par type.
  const mouvementsProvisions = await tx.mouvementProvision.findMany({
    where: { date: { gte: dateDebut, lte: dateFin } },
    include: { provision: { select: { type: true } } },
  });
  const provisionsParType = new Map<string, { dotations: number; reprises: number }>();
  for (const m of mouvementsProvisions) {
    const type = m.provision.type;
    if (!provisionsParType.has(type)) provisionsParType.set(type, { dotations: 0, reprises: 0 });
    const entry = provisionsParType.get(type)!;
    if (m.type === "DOTATION") entry.dotations += Number(m.montant);
    else entry.reprises += Number(m.montant);
  }

  // Charges/produits constatés d'avance encore actifs, avec solde restant à étaler.
  const regularisationsActives = await tx.regularisationAvance.findMany({
    where: { statut: "ACTIVE" },
    include: { echeances: { select: { montant: true, comptabilise: true } } },
  });
  const chargesProduitsConstatesAvance = regularisationsActives.map((r) => ({
    id: r.id,
    libelle: r.libelle,
    type: r.type,
    montantTotal: Number(r.montantTotal),
    soldeRestant: r.echeances.filter((e) => !e.comptabilise).reduce((s, e) => s + Number(e.montant), 0),
  }));

  // Variation des capitaux propres de la période (résultat + mouvements classe 1).
  const { resultatNet } = await genererCompteResultat(tx, dateDebut, dateFin);
  const mouvementsCapitaux = await tx.ligneEcriture.groupBy({
    by: ["compteId"],
    where: { compte: { classe: 1 }, ecriture: { statut: { in: ["VALIDE", "CLOTURE"] }, date: { gte: dateDebut, lte: dateFin } } },
    _sum: { debit: true, credit: true },
  });
  const variationCapitauxPropres = mouvementsCapitaux.reduce((s, l) => s + (Number(l._sum.credit ?? 0) - Number(l._sum.debit ?? 0)), 0);

  // Effectifs (CDC §39 — "effectifs/données pertinentes"), à la date de clôture
  // : collaborateurs en poste (actifs ou en période d'essai), ventilés par
  // département (RH.ProfilRH.departement reste un texte libre — cf. §24).
  const effectifsParDepartement = await tx.profilRH.groupBy({
    by: ["departement"],
    where: { statut: { in: ["ACTIF", "EN_PERIODE_ESSAI"] } },
    _count: true,
  });
  const effectifs = {
    total: effectifsParDepartement.reduce((s, e) => s + e._count, 0),
    parDepartement: effectifsParDepartement.map((e) => ({ departement: e.departement ?? "Non renseigné", effectif: e._count })),
  };

  return {
    effectifs,
    immobilisations: {
      parCategorie: [...parCategorie.entries()].map(([categorie, v]) => ({ categorie, ...v })),
      brut: [...parCategorie.values()].reduce((s, v) => s + v.brutFin, 0),
      amortissementCumule: [...parCategorie.values()].reduce((s, v) => s + v.amortissementCumule, 0),
      net: [...parCategorie.values()].reduce((s, v) => s + v.net, 0),
    },
    creances: { total: sumPrefixe("41"), echeancier: balanceClients },
    dettes: { total: sumPrefixe("40"), echeancier: balanceFournisseurs },
    provisions: [...provisionsParType.entries()].map(([type, v]) => ({ type, ...v })),
    chargesProduitsConstatesAvance,
    stocks: sumClasse(3),
    tresorerie: sumClasse(5),
    capitauxPropres: sumClasse(1),
    variationCapitauxPropres,
    resultatNetPeriode: resultatNet,
    charges: sumClasse(6),
    produits: sumClasse(7),
  };
}
