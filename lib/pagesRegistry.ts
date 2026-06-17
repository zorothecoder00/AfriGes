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
      { key: "approvisionnement", label: "Approvisionnement", defaultAllowed: true, module: "logistique" },
      { key: "rapports",          label: "Rapports",          defaultAllowed: true, module: "rapports"   },
    ],
  },
  {
    role: "CAISSIER",
    label: "Caissier",
    sections: [
      { key: "synthese",            label: "Synthèse",              defaultAllowed: true, module: "caisse" },
      { key: "session",             label: "Session de caisse",     defaultAllowed: true, module: "caisse" },
      { key: "encaissement_caisse", label: "Encaissements",         defaultAllowed: true, module: "caisse" },
      { key: "decaissement",        label: "Décaissements",         defaultAllowed: true, module: "caisse" },
      { key: "transferts",          label: "Transferts",            defaultAllowed: true, module: "caisse" },
      { key: "packs",               label: "Packs & Souscriptions", defaultAllowed: true, module: "packs"  },
      { key: "historique",          label: "Historique",            defaultAllowed: true, module: "caisse" },
      { key: "recus",               label: "Reçus",                 defaultAllowed: true, module: "caisse" },
      { key: "cloture",             label: "Clôture",               defaultAllowed: true, module: "caisse" },
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
      { key: "reception",   label: "Réceptions",        defaultAllowed: true, module: "logistique" },
      { key: "affectation", label: "Affectation stock",  defaultAllowed: true, module: "logistique" },
      { key: "livraisons",  label: "Livraisons",        defaultAllowed: true, module: "logistique" },
      { key: "journal",     label: "Journal",           defaultAllowed: true, module: "logistique" },
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
      { key: "prospects",  label: "Prospects",  defaultAllowed: true, module: "terrain" },
      { key: "packs",      label: "Packs",      defaultAllowed: true, module: "packs"   },
      { key: "livraisons", label: "Livraisons", defaultAllowed: true, module: "packs"   },
      { key: "ventes",     label: "Ventes",     defaultAllowed: true, module: "terrain" },
    ],
  },
  {
    role: "RESPONSABLE_RH",
    label: "Responsable RH",
    sections: [
      { key: "dashboard",    label: "Tableau de bord",          defaultAllowed: true, module: "rh" },
      { key: "effectif",     label: "Effectif & Collaborateurs", defaultAllowed: true, module: "rh" },
      { key: "presence",     label: "Présence & Pointages",     defaultAllowed: true, module: "rh" },
      { key: "conges",       label: "Congés",                   defaultAllowed: true, module: "rh" },
      { key: "recrutement",  label: "Recrutement",              defaultAllowed: true, module: "rh" },
      { key: "formations",   label: "Formations",               defaultAllowed: true, module: "rh" },
      { key: "evaluations",  label: "Évaluations",              defaultAllowed: true, module: "rh" },
      { key: "documents",    label: "Documents RH",             defaultAllowed: true, module: "rh" },
      { key: "audit",        label: "Audit & Traçabilité",      defaultAllowed: true, module: "rh" },
      { key: "preferences",  label: "Préférences notifications", defaultAllowed: true, module: "rh" },
    ],
  },
  {
    role: "PRESIDENT_COMMISSION_RIA",
    label: "Président de Commission RIA",
    sections: [
      { key: "gouvernance",       label: "Tableau de bord commission", defaultAllowed: true,  module: null },
      { key: "reunions",          label: "Réunions (créer/animer)",    defaultAllowed: true,  module: null },
      { key: "resolutions",       label: "Résolutions (créer/valider)",defaultAllowed: true,  module: null },
      { key: "plans_actions",     label: "Plans d'action (créer/affecter)", defaultAllowed: true, module: null },
      { key: "membres",           label: "Gestion des membres",        defaultAllowed: true,  module: null },
      { key: "observations",      label: "Observations & collaboration",defaultAllowed: true,  module: null },
      { key: "rapports_valider",  label: "Valider rapports",           defaultAllowed: true,  module: null },
      { key: "comptes_rendus",    label: "Comptes rendus & PV",        defaultAllowed: true,  module: null },
      { key: "presences",         label: "Gérer les présences",        defaultAllowed: true,  module: null },
    ],
  },
  {
    role: "RAPPORTEUR_COMMISSION_RIA",
    label: "Rapporteur Commission RIA",
    sections: [
      { key: "gouvernance",       label: "Tableau de bord commission", defaultAllowed: true,  module: null },
      { key: "reunions",          label: "Réunions (consultation)",    defaultAllowed: true,  module: null },
      { key: "resolutions",       label: "Résolutions (brouillon)",    defaultAllowed: true,  module: null },
      { key: "plans_actions",     label: "Plans d'action (lecture)",   defaultAllowed: true,  module: null },
      { key: "observations",      label: "Observations & collaboration",defaultAllowed: true,  module: null },
      { key: "analyses",          label: "Préparer analyses",          defaultAllowed: true,  module: null },
      { key: "rapports_generer",  label: "Générer rapports",           defaultAllowed: true,  module: null },
      { key: "comptes_rendus",    label: "Rédiger comptes rendus",     defaultAllowed: true,  module: null },
      { key: "presences",         label: "Consulter les présences",    defaultAllowed: true,  module: null },
      { key: "rapports_valider",  label: "Valider définitivement",     defaultAllowed: false, module: null },
    ],
  },
];
