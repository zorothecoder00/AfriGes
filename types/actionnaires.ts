export enum StatutDividende {
  PLANIFIE = "PLANIFIE",
  EN_COURS = "EN_COURS",
  VERSE = "VERSE",
  ANNULE = "ANNULE",
}

export enum TypeAssemblee {
  AGO = "AGO",
  AGE = "AGE",
  CS = "CS",
  CA = "CA",
}

export enum StatutAssemblee {
  PLANIFIEE = "PLANIFIEE",
  EN_COURS = "EN_COURS",
  TERMINEE = "TERMINEE",
  ANNULEE = "ANNULEE",
}

export enum StatutParticipation {
  INVITE = "INVITE",
  CONFIRME = "CONFIRME",
  ABSENT = "ABSENT",
  PRESENT = "PRESENT",
}

export enum StatutResolution {
  EN_ATTENTE = "EN_ATTENTE",
  APPROUVEE = "APPROUVEE",
  REJETEE = "REJETEE",
}

export enum DecisionVote {
  POUR = "POUR",
  CONTRE = "CONTRE",
  ABSTENTION = "ABSTENTION",
}

export enum StatutProcuration {
  EN_ATTENTE = "EN_ATTENTE",
  ACCEPTEE = "ACCEPTEE",
  REFUSEE = "REFUSEE",
  REVOQUEE = "REVOQUEE",
}

export enum StatutActionnaire {
  ACTIF = "ACTIF",
  INACTIF = "INACTIF",
  EN_ATTENTE = "EN_ATTENTE",
  SUSPENDU = "SUSPENDU",
}

export enum TypeActionDetenue {
  ORDINAIRE = "ORDINAIRE",
  PRIVILEGIEE = "PRIVILEGIEE",
  FONDATEUR = "FONDATEUR",
  PREFERENTIELLE = "PREFERENTIELLE",
}

export enum TypeMouvementAction {
  ACHAT = "ACHAT",
  CESSION = "CESSION",
  TRANSFERT_ENTRANT = "TRANSFERT_ENTRANT",
  TRANSFERT_SORTANT = "TRANSFERT_SORTANT",
  AJUSTEMENT = "AJUSTEMENT",
}
