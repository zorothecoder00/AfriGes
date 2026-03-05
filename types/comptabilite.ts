export enum TypeCompte {
  ACTIF = "ACTIF",
  PASSIF = "PASSIF",
  CHARGES = "CHARGES",
  PRODUITS = "PRODUITS",
  TRESORERIE = "TRESORERIE",
}

export enum NatureCompte {
  DETAIL = "DETAIL",
  REGROUPEMENT = "REGROUPEMENT",
  AUXILIAIRE = "AUXILIAIRE",
}

export enum SensCompte {
  DEBITEUR = "DEBITEUR",
  CREDITEUR = "CREDITEUR",
}

export enum TypeJournalComptable {
  CAISSE = "CAISSE",
  BANQUE = "BANQUE",
  VENTES = "VENTES",
  ACHATS = "ACHATS",
  OD = "OD",
  PAIE = "PAIE",
}

export enum StatutEcriture {
  BROUILLON = "BROUILLON",
  VALIDE = "VALIDE",
  CLOTURE = "CLOTURE",
}

export enum StatutRapprochement {
  EN_COURS = "EN_COURS",
  VALIDE = "VALIDE",
}

export enum StatutTVA {
  BROUILLON = "BROUILLON",
  VALIDE = "VALIDE",
}
