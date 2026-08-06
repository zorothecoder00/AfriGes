import { prisma } from "@/lib/prisma";

/**
 * Moteur de personnalisation des messages marketing (CDC §23) : remplace les
 * variables `{{...}}` dans un gabarit texte par les données réelles du client,
 * lues en direct depuis les modules existants (CRM, ventes, fidélité) — aucune
 * donnée n'est dupliquée/recopiée sur le message, tout est résolu à l'envoi.
 *
 * Variables supportées : prenom, nom, agence, dernier_achat, montant,
 * points_fidelite, date. `{{coupon}}` est acceptée mais résolue en chaîne vide
 * (pas de source tant que le modèle Coupon — CDC §35, Phase 5 — n'existe pas).
 */

export interface ContexteMessage {
  /** Montant à afficher pour {{montant}} si le contexte n'est pas "dernier achat" (ex. relance impayé). */
  montant?: number;
}

const VARIABLE_REGEX = /\{\{\s*([a-z_]+)\s*\}\}/gi;

export async function resoudreVariables(
  template: string,
  clientId: number,
  contexte?: ContexteMessage,
): Promise<string> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      nom: true, prenom: true,
      pointDeVente: { select: { nom: true } },
      compteFidelite: { select: { soldePoints: true } },
    },
  });
  if (!client) return template;

  const dernierAchat = await prisma.venteDirecte.findFirst({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    select: { montantTotal: true, createdAt: true },
  });

  const valeurs: Record<string, string> = {
    prenom: client.prenom,
    nom: client.nom,
    agence: client.pointDeVente?.nom ?? "",
    dernier_achat: dernierAchat
      ? new Date(dernierAchat.createdAt).toLocaleDateString("fr-FR")
      : "",
    montant: (contexte?.montant ?? Number(dernierAchat?.montantTotal ?? 0)).toLocaleString("fr-FR"),
    points_fidelite: String(client.compteFidelite?.soldePoints ?? 0),
    date: new Date().toLocaleDateString("fr-FR"),
  };

  return template.replace(VARIABLE_REGEX, (match, nomVariable: string) => {
    const cle = nomVariable.toLowerCase();
    if (cle === "coupon") {
      console.warn("[Marketing] Variable {{coupon}} utilisée sans source disponible (module Coupon = Phase 5)");
      return "";
    }
    return valeurs[cle] ?? match;
  });
}

/** Liste des variables disponibles, pour l'aide contextuelle du formulaire de modèle. */
export const VARIABLES_DISPONIBLES = [
  "prenom", "nom", "agence", "dernier_achat", "montant", "points_fidelite", "date", "coupon",
] as const;
