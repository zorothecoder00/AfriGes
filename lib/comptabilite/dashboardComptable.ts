// lib/comptabilite/dashboardComptable.ts
//
// Centre de pilotage comptable (CDC Comptabilité §4) — 20 KPI + 10 séries de
// graphiques, tous dérivés d'EcritureComptable/CompteComptable/Immobilisation
// (jamais des modules opérationnels), dans le même esprit que
// lib/comptabilite/etatsFinanciers.ts dont ce fichier réutilise le bilan et le
// compte de résultat plutôt que de recalculer une seconde fois les soldes.
import type { Prisma } from "@prisma/client";
import { genererBilan, genererCompteResultat } from "@/lib/comptabilite/etatsFinanciers";
import { genererEcrituresAttente, type EcritureAttente } from "@/lib/comptabilite/comptesAttente";

type TxClient = Prisma.TransactionClient;

const STATUTS_COMPTABILISES = ["VALIDE", "CLOTURE"] as const;
const PREFIXES_CA = ["701", "705", "706", "707"];

function montantPourPrefixes(lignes: { compteNumero: string; montant: number }[], prefixes: string[]): number {
  return lignes.filter((l) => prefixes.some((p) => l.compteNumero.startsWith(p))).reduce((s, l) => s + l.montant, 0);
}
function montantPourPrefixe(lignes: { compteNumero: string; montant: number }[], prefixe: string): number {
  return montantPourPrefixes(lignes, [prefixe]);
}

export interface KpisDashboardComptable {
  chiffreAffaires: number; achats: number; charges: number; produits: number; resultat: number;
  creancesClients: number; dettesFournisseurs: number;
  tresorerie: number; soldeBancaire: number; soldeCaisse: number;
  tvaCollectee: number; tvaDeductible: number; tvaADecaisser: number; creditTva: number;
  immobilisations: number; amortissements: number; valeurNetteImmobilisations: number;
  resultatProvisoire: number;
  nombreEcritures: number; ecrituresEnAttente: number; ecrituresNonEquilibrees: number;
  rapprochementsEnAttente: number;
  /** CDC §41 — nombre de lignes du compte d'attente (471) non résolues. */
  ecrituresCompteAttente: number;
}

/** Les 20 KPI du CDC §4, calculés sur l'exercice en cours (1er janvier → maintenant) pour les flux, et « à date » pour les soldes de bilan. */
export async function genererKpisDashboard(tx: TxClient): Promise<KpisDashboardComptable> {
  const now = new Date();
  const debutExercice = new Date(now.getFullYear(), 0, 1);
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);

  const [bilan, compteResultat, immosAgg, nombreEcritures, ecrituresEnAttente, balancesEcritures, rapprochementsEnAttente, lignesTvaMois, ecrituresAttente] = await Promise.all([
    genererBilan(tx, now),
    genererCompteResultat(tx, debutExercice, now),
    tx.immobilisation.aggregate({ _sum: { coutAcquisition: true, amortissementCumule: true, valeurNetteComptable: true } }),
    tx.ecritureComptable.count(),
    tx.ecritureComptable.count({ where: { statut: "BROUILLON" } }),
    tx.ligneEcriture.groupBy({
      by: ["ecritureId"],
      where: { ecriture: { statut: { in: [...STATUTS_COMPTABILISES] } } },
      _sum: { debit: true, credit: true },
    }),
    tx.rapprochementBancaire.count({ where: { statut: "EN_COURS" } }),
    tx.ligneEcriture.findMany({
      where: { isTva: true, ecriture: { statut: "VALIDE", date: { gte: debutMois, lte: now } } },
      select: { debit: true, credit: true, compte: { select: { numero: true } } },
    }),
    genererEcrituresAttente(tx),
  ]);

  const ecrituresNonEquilibrees = balancesEcritures.filter(
    (b) => Math.abs(Number(b._sum.debit ?? 0) - Number(b._sum.credit ?? 0)) > 0.01,
  ).length;

  let tvaCollectee = 0;
  let tvaDeductible = 0;
  for (const l of lignesTvaMois) {
    if (l.compte.numero.startsWith("4431")) tvaCollectee += Number(l.credit);
    if (l.compte.numero.startsWith("4432")) tvaDeductible += Number(l.debit);
  }
  const tvaDue = tvaCollectee - tvaDeductible;

  // bilan.actif/passif contiennent déjà chaque compte non-nul dans son sens
  // "côté bilan" (CDC §36) ; la ligne synthétique "RP" porte le résultat
  // provisoire non clôturé (CDC §4).
  const resultatProvisoire =
    (bilan.passif.find((l) => l.compteNumero === "RP")?.montant ?? 0) -
    (bilan.actif.find((l) => l.compteNumero === "RP")?.montant ?? 0);

  const creancesClients = montantPourPrefixe(bilan.actif, "41");
  const dettesFournisseurs = montantPourPrefixe(bilan.passif, "40");
  const tresorerie = montantPourPrefixe(bilan.actif, "5") - montantPourPrefixe(bilan.passif, "5");
  const soldeBancaire = montantPourPrefixe(bilan.actif, "521") - montantPourPrefixe(bilan.passif, "521");
  const soldeCaisse = montantPourPrefixe(bilan.actif, "57") - montantPourPrefixe(bilan.passif, "57");

  return {
    chiffreAffaires: montantPourPrefixes(compteResultat.produits, PREFIXES_CA),
    achats: montantPourPrefixe(compteResultat.charges, "60"),
    charges: compteResultat.totalCharges,
    produits: compteResultat.totalProduits,
    resultat: compteResultat.resultatNet,
    creancesClients,
    dettesFournisseurs,
    tresorerie,
    soldeBancaire,
    soldeCaisse,
    tvaCollectee,
    tvaDeductible,
    tvaADecaisser: Math.max(0, tvaDue),
    creditTva: Math.max(0, -tvaDue),
    immobilisations: Number(immosAgg._sum.coutAcquisition ?? 0),
    amortissements: Number(immosAgg._sum.amortissementCumule ?? 0),
    valeurNetteImmobilisations: Number(immosAgg._sum.valeurNetteComptable ?? 0),
    resultatProvisoire,
    nombreEcritures,
    ecrituresEnAttente,
    ecrituresNonEquilibrees,
    rapprochementsEnAttente,
    ecrituresCompteAttente: ecrituresAttente.length,
  };
}

export type { EcritureAttente };
export { genererEcrituresAttente };

// ─────────────────────────────────────────────────────────────────────────────
// Graphiques (CDC §4) — séries mensuelles glissantes sur 12 mois (24 mois pour
// la comparaison N/N-1), calculées en 4 requêtes au total (3 soldes d'ouverture
// + 1 lecture groupée des lignes de la fenêtre), quel que soit le nombre de mois.
// ─────────────────────────────────────────────────────────────────────────────

const LABELS_MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
function cleMois(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function labelMois(cle: string): string { const [y, m] = cle.split("-"); return `${LABELS_MOIS[Number(m) - 1]} ${y.slice(2)}`; }

interface PointSerie { mois: string; label: string; valeur: number }
interface PointResultatMensuel { mois: string; label: string; produits: number; charges: number; resultat: number }

const LABELS_CHARGES: Record<string, string> = {
  "60": "Achats", "61": "Transports", "62": "Services extérieurs A", "63": "Services extérieurs B",
  "64": "Impôts et taxes", "65": "Autres charges", "66": "Charges de personnel",
  "67": "Charges financières", "68": "Dotations aux amortissements", "69": "Dotations aux provisions",
};
const LABELS_PRODUITS: Record<string, string> = {
  "70": "Ventes", "71": "Subventions d'exploitation", "72": "Production immobilisée",
  "73": "Variation stocks produits", "75": "Autres produits", "77": "Revenus financiers",
  "78": "Transferts de charges", "79": "Reprises",
};

export interface GraphiquesDashboardComptable {
  evolutionCA: PointSerie[];
  evolutionCharges: PointSerie[];
  evolutionResultat: PointSerie[];
  evolutionTresorerie: PointSerie[];
  creancesClients: PointSerie[];
  dettesFournisseurs: PointSerie[];
  depensesParCategorie: { categorie: string; montant: number }[];
  revenusParActivite: { activite: string; montant: number }[];
  resultatMensuel: PointResultatMensuel[];
  comparaisonNN1: {
    labels: string[];
    anneeActuelle: { annee: number; valeurs: number[] };
    anneePrecedente: { annee: number; valeurs: number[] };
  };
}

export async function genererGraphiquesDashboard(tx: TxClient): Promise<GraphiquesDashboardComptable> {
  const now = new Date();
  const anneeActuelle = now.getFullYear();
  const anneePrecedente = anneeActuelle - 1;
  const debutFenetre = new Date(anneePrecedente, 0, 1);
  const debutExercice = new Date(anneeActuelle, 0, 1);

  const [openingTreso, openingCreances, openingDettes, lignes] = await Promise.all([
    tx.ligneEcriture.aggregate({
      where: { compte: { classe: 5 }, ecriture: { statut: { in: [...STATUTS_COMPTABILISES] }, date: { lt: debutFenetre } } },
      _sum: { debit: true, credit: true },
    }),
    tx.ligneEcriture.aggregate({
      where: { compte: { numero: { startsWith: "41" } }, ecriture: { statut: { in: [...STATUTS_COMPTABILISES] }, date: { lt: debutFenetre } } },
      _sum: { debit: true, credit: true },
    }),
    tx.ligneEcriture.aggregate({
      where: { compte: { numero: { startsWith: "40" } }, ecriture: { statut: { in: [...STATUTS_COMPTABILISES] }, date: { lt: debutFenetre } } },
      _sum: { debit: true, credit: true },
    }),
    tx.ligneEcriture.findMany({
      where: {
        ecriture: { statut: { in: [...STATUTS_COMPTABILISES] }, date: { gte: debutFenetre, lte: now } },
        OR: [
          { compte: { classe: 5 } },
          { compte: { classe: 6 } },
          { compte: { classe: 7 } },
          { compte: { numero: { startsWith: "41" } } },
          { compte: { numero: { startsWith: "40" } } },
        ],
      },
      select: { debit: true, credit: true, compte: { select: { numero: true, classe: true } }, ecriture: { select: { date: true } } },
    }),
  ]);

  interface Bucket { ca: number; charges: number; produits: number; tresoDelta: number; creancesDelta: number; dettesDelta: number }
  const buckets = new Map<string, Bucket>();
  function bucket(cle: string): Bucket {
    let b = buckets.get(cle);
    if (!b) { b = { ca: 0, charges: 0, produits: 0, tresoDelta: 0, creancesDelta: 0, dettesDelta: 0 }; buckets.set(cle, b); }
    return b;
  }

  const depensesMap = new Map<string, number>();
  const revenusMap = new Map<string, number>();

  for (const l of lignes) {
    const debit = Number(l.debit);
    const credit = Number(l.credit);
    const numero = l.compte.numero;
    const classe = l.compte.classe;
    const b = bucket(cleMois(l.ecriture.date));

    if (classe === 7 && PREFIXES_CA.some((p) => numero.startsWith(p))) b.ca += credit - debit;
    if (classe === 6) b.charges += debit - credit;
    if (classe === 7) b.produits += credit - debit;
    if (classe === 5) b.tresoDelta += debit - credit;
    if (numero.startsWith("41")) b.creancesDelta += debit - credit;
    if (numero.startsWith("40")) b.dettesDelta += credit - debit;

    if (l.ecriture.date >= debutExercice) {
      const prefixe2 = numero.slice(0, 2);
      if (classe === 6) depensesMap.set(prefixe2, (depensesMap.get(prefixe2) ?? 0) + (debit - credit));
      if (classe === 7) revenusMap.set(prefixe2, (revenusMap.get(prefixe2) ?? 0) + (credit - debit));
    }
  }

  const moisFenetre: string[] = [];
  for (let d = new Date(debutFenetre); d <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) moisFenetre.push(cleMois(d));

  let runningTreso = Number(openingTreso._sum.debit ?? 0) - Number(openingTreso._sum.credit ?? 0);
  let runningCreances = Number(openingCreances._sum.debit ?? 0) - Number(openingCreances._sum.credit ?? 0);
  let runningDettes = Number(openingDettes._sum.credit ?? 0) - Number(openingDettes._sum.debit ?? 0);

  const serieComplete = moisFenetre.map((cle) => {
    const b = buckets.get(cle) ?? { ca: 0, charges: 0, produits: 0, tresoDelta: 0, creancesDelta: 0, dettesDelta: 0 };
    runningTreso += b.tresoDelta;
    runningCreances += b.creancesDelta;
    runningDettes += b.dettesDelta;
    return {
      mois: cle, label: labelMois(cle),
      ca: b.ca, charges: b.charges, produits: b.produits, resultat: b.produits - b.charges,
      tresorerie: runningTreso, creances: runningCreances, dettes: runningDettes,
    };
  });

  const derniers12 = serieComplete.slice(-12);

  function serieAnnuelle(annee: number): number[] {
    return Array.from({ length: 12 }, (_, i) => {
      const cle = `${annee}-${String(i + 1).padStart(2, "0")}`;
      return serieComplete.find((s) => s.mois === cle)?.ca ?? 0;
    });
  }

  const depensesParCategorie = [...depensesMap.entries()]
    .filter(([, v]) => Math.abs(v) > 0.01)
    .map(([prefixe, montant]) => ({ categorie: LABELS_CHARGES[prefixe] ?? `Classe ${prefixe}`, montant }))
    .sort((a, b) => b.montant - a.montant);
  const revenusParActivite = [...revenusMap.entries()]
    .filter(([, v]) => Math.abs(v) > 0.01)
    .map(([prefixe, montant]) => ({ activite: LABELS_PRODUITS[prefixe] ?? `Classe ${prefixe}`, montant }))
    .sort((a, b) => b.montant - a.montant);

  return {
    evolutionCA: derniers12.map((s) => ({ mois: s.mois, label: s.label, valeur: s.ca })),
    evolutionCharges: derniers12.map((s) => ({ mois: s.mois, label: s.label, valeur: s.charges })),
    evolutionResultat: derniers12.map((s) => ({ mois: s.mois, label: s.label, valeur: s.resultat })),
    evolutionTresorerie: derniers12.map((s) => ({ mois: s.mois, label: s.label, valeur: s.tresorerie })),
    creancesClients: derniers12.map((s) => ({ mois: s.mois, label: s.label, valeur: s.creances })),
    dettesFournisseurs: derniers12.map((s) => ({ mois: s.mois, label: s.label, valeur: s.dettes })),
    depensesParCategorie,
    revenusParActivite,
    resultatMensuel: derniers12.map((s) => ({ mois: s.mois, label: s.label, produits: s.produits, charges: s.charges, resultat: s.resultat })),
    comparaisonNN1: {
      labels: LABELS_MOIS,
      anneeActuelle: { annee: anneeActuelle, valeurs: serieAnnuelle(anneeActuelle) },
      anneePrecedente: { annee: anneePrecedente, valeurs: serieAnnuelle(anneePrecedente) },
    },
  };
}
