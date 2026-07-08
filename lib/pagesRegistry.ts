/**
 * Clé du SystemModule associé à cette section.
 * null = section toujours accessible (pas liée à un module désactivable).
 * Si le module est inactif, la section est bloquée quelle que soit la config rôle/user.
 */
export type PageSection = {
  key: string;
  label: string;
  defaultAllowed: boolean;
  module: string | null;
};

export type RoleRegistry = {
  role: string;
  label: string;
  sections: PageSection[];
};

export const PAGES_REGISTRY: RoleRegistry[] = [
  {
    role: "RESPONSABLE_POINT_DE_VENTE",
    label: "Responsable PDV",
    sections: [
      { key: "synthese",          label: "Synthèse",          defaultAllowed: true, module: null          },
      { key: "ventes",            label: "Ventes",            defaultAllowed: true, module: "ventes"      },
      { key: "stock",             label: "Stock & Produits",  defaultAllowed: true, module: "stock"       },
      { key: "approvisionnement", label: "Approvisionnement", defaultAllowed: true, module: "logistique"  },
      { key: "livraisons",        label: "Livraisons",        defaultAllowed: true, module: "logistique"  },
      { key: "ventes-terrain",    label: "Ventes Terrain",    defaultAllowed: true, module: "terrain"     },
      { key: "caisse",            label: "Caisse PDV",        defaultAllowed: true, module: "caisse"      },
      { key: "clients",           label: "Clients",           defaultAllowed: true, module: null          },
      { key: "equipe",            label: "Équipe",            defaultAllowed: true, module: null          },
      { key: "rapports",          label: "Rapports",          defaultAllowed: true, module: "rapports"    },
    ],
  },
  {
    role: "CHEF_AGENCE",
    label: "Chef d'agence",
    sections: [
      { key: "vue_generale",      label: "Vue générale",      defaultAllowed: true, module: null         },
      { key: "pdvs",              label: "Points de vente",   defaultAllowed: true, module: null         },
      { key: "ventes",            label: "Ventes",            defaultAllowed: true, module: "ventes"     },
      { key: "stock",             label: "Stock",             defaultAllowed: true, module: "stock"      },
      { key: "caisse",            label: "Caisse",            defaultAllowed: true, module: "caisse"     },
      { key: "equipe",            label: "Équipe",            defaultAllowed: true, module: null         },
      { key: "clients",           label: "Clients",           defaultAllowed: true, module: null         },
      { key: "comptes-courants",  label: "Comptes courants",  defaultAllowed: true, module: null         },
      { key: "approvisionnement", label: "Approvisionnement", defaultAllowed: true, module: "logistique" },
      { key: "rapports",          label: "Rapports",          defaultAllowed: true, module: "rapports"   },
    ],
  },
  {
    role: "CAISSIER",
    label: "Caissier",
    sections: [
      { key: "synthese",            label: "Synthèse",              defaultAllowed: true, module: "caisse" },
      { key: "a_confirmer",         label: "À confirmer",           defaultAllowed: true, module: "caisse" },
      { key: "session",             label: "Session de caisse",     defaultAllowed: true, module: "caisse" },
      { key: "encaissement_caisse", label: "Encaissements",         defaultAllowed: true, module: "caisse" },
      { key: "credits_clients",     label: "Crédits clients",       defaultAllowed: true, module: "caisse" },
      { key: "decaissement",        label: "Décaissements",         defaultAllowed: true, module: "caisse" },
      { key: "transferts",          label: "Transferts",            defaultAllowed: true, module: "caisse" },
      { key: "packs",               label: "Packs & Souscriptions", defaultAllowed: true, module: "packs"  },
      { key: "historique",          label: "Historique",            defaultAllowed: true, module: "caisse" },
      { key: "recus",               label: "Reçus",                 defaultAllowed: true, module: "caisse" },
      { key: "factures",            label: "Factures",              defaultAllowed: true, module: "caisse" },
      { key: "cloture",             label: "Clôture",               defaultAllowed: true, module: "caisse" },
      { key: "comptes-courants",    label: "Comptes courants",      defaultAllowed: true, module: null     },
    ],
  },
  {
    role: "MAGAZINIER",
    label: "Magasinier",
    sections: [
      { key: "inventaire", label: "Inventaire",             defaultAllowed: true, module: "stock"      },
      { key: "journal",    label: "Journal des mouvements", defaultAllowed: true, module: "stock"      },
      { key: "reception",  label: "Réceptions",             defaultAllowed: true, module: "logistique" },
      { key: "livraisons", label: "Livraisons packs",       defaultAllowed: true, module: "packs"      },
      { key: "alertes",    label: "Alertes stock",          defaultAllowed: true, module: "stock"      },
      { key: "sorties",    label: "Bons de sortie",         defaultAllowed: true, module: "stock"      },
      { key: "anomalies",  label: "Anomalies",              defaultAllowed: true, module: "stock"      },
    ],
  },
  {
    role: "AGENT_LOGISTIQUE_APPROVISIONNEMENT",
    label: "Agent Logistique",
    sections: [
      { key: "reception",   label: "Réceptions",          defaultAllowed: true, module: "logistique" },
      { key: "affectation", label: "Affectation stock",   defaultAllowed: true, module: "logistique" },
      { key: "livraisons",  label: "Livraisons",          defaultAllowed: true, module: "logistique" },
      { key: "journal",     label: "Journal",             defaultAllowed: true, module: "logistique" },
      { key: "anomalies",   label: "Anomalies & Inventaire", defaultAllowed: true, module: "logistique" },
    ],
  },
  {
    role: "COMPTABLE",
    label: "Comptable",
    sections: [
      { key: "synthese",      label: "Synthèse",              defaultAllowed: true, module: "comptabilite" },
      { key: "plan",          label: "Plan Comptable",        defaultAllowed: true, module: "comptabilite" },
      { key: "saisie",        label: "Écritures",             defaultAllowed: true, module: "comptabilite" },
      { key: "journal",       label: "Journal",               defaultAllowed: true, module: "comptabilite" },
      { key: "tresorerie",    label: "Trésorerie",            defaultAllowed: true, module: "comptabilite" },
      { key: "balance",       label: "Balance",               defaultAllowed: true, module: "comptabilite" },
      { key: "grandlivre",    label: "Grand Livre",           defaultAllowed: true, module: "comptabilite" },
      { key: "tva",           label: "TVA",                   defaultAllowed: true, module: "comptabilite" },
      { key: "rapprochement", label: "Rapprochement",         defaultAllowed: true, module: "comptabilite" },
      { key: "etats",         label: "États Financiers",      defaultAllowed: true, module: "comptabilite" },
      { key: "pieces",        label: "Pièces justificatives", defaultAllowed: true, module: "comptabilite" },
    ],
  },
  {
    role: "AGENT_TERRAIN",
    label: "Agent Terrain",
    sections: [
      { key: "collecteJour",       label: "Collecte du Jour",   defaultAllowed: true, module: "terrain" },
      { key: "credits",            label: "Crédits",            defaultAllowed: true, module: "terrain" },
      { key: "packs",              label: "Packs",              defaultAllowed: true, module: "packs"   },
      { key: "livraisons",         label: "Livraisons",         defaultAllowed: true, module: "packs"   },
      { key: "ventes",             label: "Ventes",             defaultAllowed: true, module: "terrain" },
      { key: "prospects",          label: "Prospects",          defaultAllowed: true, module: "terrain" },
      { key: "portefeuilleCredit", label: "Portefeuille Crédit", defaultAllowed: true, module: "terrain" },
    ],
  },
  {
    role: "RESPONSABLE_RH",
    label: "Responsable RH",
    // Sections alignées sur les sous-pages réelles de /dashboard/user/responsablesRH.
    // module: null → l'accès est piloté par la config rôle/utilisateur (pas par un toggle
    // de module), ce qui évite de verrouiller tout le RH si le module était inactif —
    // important car ces sections sont désormais réellement gardées (layout de garde).
    sections: [
      { key: "dashboard",      label: "Tableau de bord",           defaultAllowed: true, module: null },
      { key: "collaborateurs", label: "Collaborateurs",            defaultAllowed: true, module: null },
      { key: "pointages",      label: "Pointages & Présence",      defaultAllowed: true, module: null },
      { key: "conges",         label: "Congés",                    defaultAllowed: true, module: null },
      { key: "recrutement",    label: "Recrutement",               defaultAllowed: true, module: null },
      { key: "missions",       label: "Missions",                  defaultAllowed: true, module: null },
      { key: "paie",           label: "Paie",                      defaultAllowed: true, module: null },
      { key: "onboarding",     label: "Onboarding",                defaultAllowed: true, module: null },
      { key: "audit",          label: "Audit & Traçabilité",       defaultAllowed: true, module: null },
      { key: "preferences",    label: "Préférences notifications", defaultAllowed: true, module: null },
      { key: "notifications",  label: "Déclencheurs notifications", defaultAllowed: true, module: null },
    ],
  },
  // NB : PRESIDENT_COMMISSION_RIA / RAPPORTEUR_COMMISSION_RIA ne sont pas dans ce registre :
  // leur portail (/dashboard/user/gouvernance) est accessible aux membres de commission
  // tous rôles confondus → l'accès s'y gère par appartenance à une commission, pas par le
  // contrôle d'accès aux pages basé sur le rôle gestionnaire.
];
