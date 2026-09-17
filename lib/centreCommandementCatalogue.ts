/**
 * Centre de commandement — annuaire statique des documents du CDC
 * digitalisation (voir cdcdigitalisation.txt pour le détail complet de
 * chaque circuit). Fichier PUR (pas d'import prisma) : consommé directement
 * par la page client du Centre de commandement.
 */

export type EntreeCatalogue = {
  id: string;
  module: string; // "§3.1", "§5.6", ...
  titre: string;
  description: string;
  roles: string[];
  pageUrl: string;
  rolesRestreints?: boolean; // true = visible seulement pour Admin/Super Admin dans l'UI
};

export const CATALOGUE_DOCUMENTS: EntreeCatalogue[] = [
  // ── Partie A — documents prioritaires (§3.1 à §3.6) ──────────────────────
  {
    id: "brf",
    module: "§3.1",
    titre: "Bordereau de remise de fonds",
    description: "Remise des fonds terrain (cotisations, remboursements, ventes) à la trésorerie, avec billetage contradictoire et visa CGT.",
    roles: ["Agent terrain", "Comptable/Trésorier", "Admin"],
    pageUrl: "/dashboard/user/comptables/tresorerie/bordereaux-remise",
  },
  {
    id: "bcc",
    module: "§3.2",
    titre: "Bon de commande client",
    description: "Prise de commande terrain, signature électronique client, génération automatique du Bon de sortie une fois validée.",
    roles: ["Agent terrain", "Commercial", "RVC"],
    pageUrl: "/dashboard/user/agentsTerrain/commandes-client",
  },
  {
    id: "bcf",
    module: "§3.3",
    titre: "Bon de commande fournisseur",
    description: "Commande AfriSime → fournisseur, circuit DRAFT → APPROVED → SENT → COMPLETED, visa CGT si montant élevé.",
    roles: ["Agent Logistique/Approvisionnement", "Admin"],
    pageUrl: "/dashboard/user/logistiquesApprovisionnements/bons-commande",
  },
  {
    id: "bsm",
    module: "§3.4",
    titre: "Bon de sortie de marchandises",
    description: "Sortie physique de stock (livraison client, transfert, perte, casse, don...), génère le Bon de livraison associé.",
    roles: ["Magasinier", "Admin"],
    pageUrl: "/dashboard/user/magasiniers",
  },
  {
    id: "br",
    module: "§3.5",
    titre: "Bon de réception (client)",
    description: "Attestation client de réception, sans compte requis (lien SMS à jeton opaque). Consultable depuis la commande client liée.",
    roles: ["Agent terrain", "Client (lien SMS)"],
    pageUrl: "/dashboard/user/agentsTerrain/commandes-client",
  },
  {
    id: "fd",
    module: "§3.6",
    titre: "Fiche de décaissement",
    description: "Toute sortie de fonds (achat, avance, frais). Approbation N1/N2 selon seuil, exécution par le Comptable.",
    roles: ["Tout gestionnaire (créateur)", "Comptable (exécution)"],
    pageUrl: "/dashboard/user/decaissements",
  },

  // ── Partie B — catalogue par module (§5.2 à §5.9) ────────────────────────
  {
    id: "devis-proforma",
    module: "§5.2",
    titre: "Devis / Proforma",
    description: "Proposition commerciale, conversion Devis → Proforma, réponse client sans compte via lien à jeton.",
    roles: ["Agent terrain", "Commercial", "Admin"],
    pageUrl: "/dashboard/user/agentsTerrain/devis-proforma",
  },
  {
    id: "bon-livraison",
    module: "§5.2",
    titre: "Bon de livraison",
    description: "Généré automatiquement à la validation du Bon de sortie — document de transport figé une fois émis.",
    roles: ["Magasinier", "Admin"],
    pageUrl: "/dashboard/user/magasiniers",
  },
  {
    id: "facture",
    module: "§5.2",
    titre: "Facture / Facture à crédit / Avoir",
    description: "Générée automatiquement à chaque vente (fenêtre \"Facture\" sur les pages de vente). Facture d'avoir réservée au Comptable.",
    roles: ["Caissier", "RPV", "Comptable", "Admin"],
    pageUrl: "/dashboard/admin/ventes",
  },
  {
    id: "achats-fournisseurs",
    module: "§5.3",
    titre: "Demande d'achat / RFQ / Réception / Facture fournisseur",
    description: "Circuit achats complet : demande interne, cotation comparative, réception + contrôle, facture fournisseur (rapprochement).",
    roles: ["Agent Logistique/Approvisionnement", "Comptable"],
    pageUrl: "/dashboard/user/logistiquesApprovisionnements",
  },
  {
    id: "credit",
    module: "§5.4",
    titre: "Dossier de crédit (contrat, échéancier, reçus, avis, recouvrement)",
    description: "Demande/contrat de crédit, carnet digital (/suivi), reçus de remboursement, avis d'échéance, actions de recouvrement, attestation de solde.",
    roles: ["RVC", "Admin"],
    pageUrl: "/dashboard/admin/credits",
  },
  {
    id: "depot-vente",
    module: "§5.5",
    titre: "Dépôt-vente (convention, fiche de dépôt, état des ventes)",
    description: "Convention fournisseur, fiche de dépôt de marchandises, état stock/ventes/invendus, demande de règlement.",
    roles: ["Agent Logistique/Approvisionnement", "Admin"],
    pageUrl: "/dashboard/user/logistiquesApprovisionnements/depot-vente",
  },
  {
    id: "revendeurs",
    module: "§5.6",
    titre: "Comptes revendeurs (B2B) — ouverture, commandes, factures, relevé",
    description: "Fiche d'ouverture/carte pro/convention/attestation, bons de commande, factures et bons de livraison revendeur, relevé de compte.",
    roles: ["RVC", "Admin", "Revendeur (self-service)"],
    pageUrl: "/dashboard/admin/revendeurs",
  },
  {
    id: "tournees",
    module: "§5.7",
    titre: "Tournées de livraison",
    description: "Fiche de tournée (mission/chargement/bordereau), fiches d'arrêt (livré/non effectué/incident/retour).",
    roles: ["Agent Logistique/Approvisionnement", "Magasinier", "Admin"],
    pageUrl: "/dashboard/user/logistiquesApprovisionnements/tournees",
  },
  {
    id: "reclamations",
    module: "§5.8",
    titre: "Réclamations, retours et remplacements",
    description: "Formulaire de réclamation, fiche de traitement/clôture, fiche de retour marchandise, bon de remplacement, rapport d'incident, avoir client.",
    roles: ["RPV", "Chef d'agence", "Magasinier", "Admin"],
    pageUrl: "/dashboard/admin/reclamations",
  },
  {
    id: "controle-commercial",
    module: "§5.9",
    titre: "Contrôle commercial & reporting",
    description: "Tableau de bord consolidé : ventes, crédit, encaissements, impayés, recouvrement, retours, réclamations, performances.",
    roles: ["Admin / Super Admin"],
    pageUrl: "/dashboard/admin/controle-commercial",
    rolesRestreints: true,
  },
];
