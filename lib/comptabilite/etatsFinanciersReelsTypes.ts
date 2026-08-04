// lib/comptabilite/etatsFinanciersReelsTypes.ts
//
// Types partagés côté client pour /api/comptable/etats-financiers-reels, reflétant
// fidèlement lib/comptabilite/etatsFinanciers.ts (genererBilan/genererCompteResultat/
// genererTableauFlux/genererNotesAnnexes). Utilisé par les 4 pages qui affichent
// chacune une section de cette même réponse (Bilan / Compte de résultat / Tableau
// des flux / Notes annexes) — fichier de types pur, aucun import de `prisma`.
export interface LigneEtatFinancier { compteNumero: string; libelle: string; montant: number }

export interface LigneBalanceAgeeEntry {
  tiersId: number;
  tiersNom: string;
  compteNumero: string;
  tranche0_30: number;
  tranche31_60: number;
  tranche61_90: number;
  tranche90Plus: number;
  total: number;
}

export interface ImmobilisationCategorieMouvement {
  categorie: string;
  brutDebut: number;
  acquisitionsPeriode: number;
  cessionsPeriode: number;
  brutFin: number;
  amortissementCumule: number;
  net: number;
}

export interface ChargeProduitConstateAvanceEntry {
  id: number;
  libelle: string;
  type: "CHARGE_CONSTATEE_AVANCE" | "PRODUIT_CONSTATE_AVANCE";
  montantTotal: number;
  soldeRestant: number;
}

export interface MouvementProvisionParType { type: string; dotations: number; reprises: number }

export interface EtatsFinanciersReelsData {
  annee: number;
  bilan: {
    actif: LigneEtatFinancier[];
    passif: LigneEtatFinancier[];
    totalActif: number;
    totalPassif: number;
    equilibre: boolean;
  };
  compteResultat: {
    produits: LigneEtatFinancier[];
    charges: LigneEtatFinancier[];
    totalProduits: number;
    totalCharges: number;
    resultatNet: number;
    // Niveaux de résultat SYSCOHADA (CDC §37) — genererCompteResultatDetaille.
    exploitation: { produits: number; charges: number; resultat: number };
    financier: { produits: number; charges: number; resultat: number };
    resultatActivitesOrdinaires: number;
    hao: { produits: number; charges: number; resultat: number };
    impotsSurResultat: number;
  };
  tableauFlux: {
    encaissements: number;
    decaissements: number;
    fluxNet: number;
    parJournal: Record<string, number>;
    // Méthode indirecte complète (CDC §38) — genererTableauFluxDetaille.
    resultatNet: number;
    dotationsAmortissementsProvisions: number;
    reprisesAmortissementsProvisions: number;
    cafg: number;
    variationBFR: { stocks: number; creances: number; dettesFournisseurs: number; total: number };
    fluxActiviteOperationnelle: number;
    investissement: { acquisitionsImmobilisations: number; cessionsImmobilisations: number; total: number };
    financement: { variationCapitauxPropres: number; variationEmprunts: number; total: number };
    fluxNetTotal: number;
    variationTresorerieReelle: number;
    ecartReconciliation: number;
  };
  notesAnnexes: {
    effectifs: { total: number; parDepartement: { departement: string; effectif: number }[] };
    engagements: { total: number; parType: { type: string; montant: number }[] };
    immobilisations: { parCategorie: ImmobilisationCategorieMouvement[]; brut: number; amortissementCumule: number; net: number };
    creances: { total: number; echeancier: LigneBalanceAgeeEntry[] };
    dettes: { total: number; echeancier: LigneBalanceAgeeEntry[] };
    provisions: MouvementProvisionParType[];
    chargesProduitsConstatesAvance: ChargeProduitConstateAvanceEntry[];
    stocks: number;
    tresorerie: number;
    capitauxPropres: number;
    variationCapitauxPropres: number;
    resultatNetPeriode: number;
    charges: number;
    produits: number;
  };
  // CDC §48 — genererResultatParPointDeVente : produits/charges/résultat de la
  // période ventilés par point de vente ("Non affecté" si pointDeVenteId absent).
  resultatParPointDeVente: {
    pointDeVenteId: number | null;
    nom: string;
    code: string | null;
    produits: number;
    charges: number;
    resultat: number;
  }[];
}

export interface EtatsFinanciersReelsResponse { data: EtatsFinanciersReelsData }

// Reprend exactement les libellés de CATEGORIE_LABELS du monolithe (CategorieImmobilisation).
export const CATEGORIE_IMMO_LABELS: Record<string, string> = {
  TERRAIN: "Terrain", BATIMENT: "Bâtiment", MATERIEL_MOBILIER: "Matériel et mobilier",
  MATERIEL_TRANSPORT: "Matériel de transport", MATERIEL_INFORMATIQUE: "Matériel informatique", AUTRE: "Autre",
};
