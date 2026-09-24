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
  email:     "administration@afrisime.com",
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

/**
 * Coordonnées imprimées sur les formulaires papier AfriSime reproduits à l'identique
 * (fiche de décaissement) — libellés exigés tels quels par la Direction, distincts des
 * coordonnées officielles de SOCIETE ci-dessus.
 */
export const SOCIETE_FORMULAIRES = {
  raisonSociale: "AFRISIME SARL",
  adresse:       "Lomé – Adidogomé",
  telephone:     "+228 93245764/98404545/90880604",
  email:         "afrisimea@gmail.com",
} as const;

/** Mentions légales imprimées en pied des formulaires papier (reprises telles quelles). */
export const MENTIONS_LEGALES_FORMULAIRES =
  "Cette facture pro-forma n'a pas valeur de facture définitive. Les prix indiqués sont sujets à modification en fonction des conditions du marché ou des volumes commandés.";
