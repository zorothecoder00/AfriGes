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

/** Notes annexes (CDC §39) : synthèse des postes-clés, tous dérivés des écritures/immobilisations. */
export async function genererNotesAnnexes(tx: TxClient, dateFin: Date) {
  const soldes = await soldesParCompte(tx, null, dateFin);
  const sumClasse = (classe: number) =>
    [...soldes.values()].filter((c) => c.classe === classe).reduce((s, c) => s + Math.abs(c.solde), 0);
  const sumPrefixe = (prefixe: string) =>
    [...soldes.values()].filter((c) => c.numero.startsWith(prefixe)).reduce((s, c) => s + Math.max(0, c.solde), 0);

  const immobilisations = await tx.immobilisation.aggregate({
    _sum: { coutAcquisition: true, amortissementCumule: true, valeurNetteComptable: true },
  });

  return {
    immobilisations: {
      brut: Number(immobilisations._sum.coutAcquisition ?? 0),
      amortissementCumule: Number(immobilisations._sum.amortissementCumule ?? 0),
      net: Number(immobilisations._sum.valeurNetteComptable ?? 0),
    },
    stocks: sumClasse(3),
    creances: sumPrefixe("41"),
    dettes: sumPrefixe("40"),
    tresorerie: sumClasse(5),
    capitauxPropres: sumClasse(1),
    charges: sumClasse(6),
    produits: sumClasse(7),
  };
}
