// lib/livraisonConfirmation.ts
// Accès SANS login (lien à jeton opaque, sur le modèle de lib/agentScan.ts) à la
// confirmation de réception d'un Bon de Réception (CDC digitalisation §3.5).
// Le client (ou le livreur, sur son propre terminal) ouvre ce lien pour attester
// la livraison — signature électronique + éventuel écart/réserve. Serveur only.

import { randomBytes } from "crypto";

/** Jeton opaque URL-safe (~32 caractères, non devinable). */
export function nouveauJetonConfirmation(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Base publique pour le lien de confirmation. Priorité à une URL configurée
 * (NEXT_PUBLIC_APP_URL / APP_URL) — indispensable en prod et pour ouvrir le lien
 * depuis un téléphone (sinon l'origine vaudrait « localhost »).
 */
export function baseUrlPourLivraison(req: Request): string {
  const configuree = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configuree) return configuree.replace(/\/+$/, "");
  return new URL(req.url).origin;
}

/** URL complète du lien de confirmation de réception. */
export function livraisonConfirmationUrl(req: Request, token: string): string {
  return `${baseUrlPourLivraison(req)}/livraison/${token}`;
}
