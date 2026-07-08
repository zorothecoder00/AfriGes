// lib/societe.ts
// Identité légale de la société — source unique de vérité.
// Réutilisée sur tous les documents officiels (bordereaux, relevés/attestations/
// carnets compte courant, reçus, factures, page de suivi). Un changement de RCCM /
// NIF / baseline se fait ici et se propage partout.

export const SOCIETE = {
  nom:      "AFRISIME",
  baseline: "Réinventer la distribution pour une Afrique plus prospère",
  rccm:     "TG-LFW-01-2026-B12-00649",
  nif:      "1002122728",
  // Coordonnées
  adresse:   "Adidogomé (Lomé) - Togo",
  telephone: "+228 98 40 45 45 / 93 24 57 64",
  email:     "afrisimea@afrisime.com",
  siteWeb:   "www.afrisime.com",
  activites: [
    "Commerce Général | Vente en Gros | Vente au Détail",
    "Vente à Crédit | Import-Export | Logistique & Livraison",
  ],
} as const;

/** Ligne légale : « RCCM : … | NIF : … ». */
export const SOCIETE_LEGAL = `RCCM : ${SOCIETE.rccm} | NIF : ${SOCIETE.nif}`;

/** Ligne siège complète : « Siège : … | Tél : … | email | site ». */
export const SOCIETE_SIEGE = `Siège : ${SOCIETE.adresse} | Tél : ${SOCIETE.telephone} | ${SOCIETE.email} | ${SOCIETE.siteWeb}`;

/** Pied de document standard (sans la date) : « AFRISIME — baseline · RCCM … | NIF … ». */
export const SOCIETE_PIED = `${SOCIETE.nom} — ${SOCIETE.baseline} · ${SOCIETE_LEGAL}`;
