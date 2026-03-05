export enum StatutSessionCaisse {
  OUVERTE = "OUVERTE",
  SUSPENDUE = "SUSPENDUE",
  FERMEE = "FERMEE",
}

export enum ModePaiement {
  ESPECES = "ESPECES",
  VIREMENT = "VIREMENT",
  CHEQUE = "CHEQUE",
  MOBILE_MONEY = "MOBILE_MONEY",
}

export enum TypeOperationCaisse {
  ENCAISSEMENT = "ENCAISSEMENT",
  DECAISSEMENT = "DECAISSEMENT",
}

export enum CategorieDecaissement {
  SALAIRE = "SALAIRE",
  AVANCE = "AVANCE",
  FOURNISSEUR = "FOURNISSEUR",
  AUTRE = "AUTRE",
}

export enum ModePaiementVente {
  ESPECES = "ESPECES",
  VIREMENT = "VIREMENT",
  CHEQUE = "CHEQUE",
  MOBILE_MONEY = "MOBILE_MONEY",
  WALLET = "WALLET",
  CREDIT = "CREDIT",
}

export enum StatutVenteDirecte {
  BROUILLON = "BROUILLON",
  CONFIRMEE = "CONFIRMEE",
  ANNULEE = "ANNULEE",
}
