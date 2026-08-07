import { prisma } from "@/lib/prisma";

/**
 * Moteur de personnalisation des messages marketing (CDC §23) : remplace les
 * variables `{{...}}` dans un gabarit texte par les données réelles du client,
 * lues en direct depuis les modules existants (CRM, ventes, fidélité) — aucune
 * donnée n'est dupliquée/recopiée sur le message, tout est résolu à l'envoi.
 *
 * Variables supportées : prenom, nom, agence, dernier_achat, montant,
 * points_fidelite, date, coupon, offre.
 */

export interface ContexteMessage {
  /** Montant à afficher pour {{montant}} si le contexte n'est pas "dernier achat" (ex. relance impayé). */
  montant?: number;
  /** Code coupon à afficher pour {{coupon}} (action ATTRIBUER_COUPON de l'automatisation, CDC §19). */
  couponCode?: string;
  /** Libellé d'offre/promotion à afficher pour {{offre}} (action ENVOYER_OFFRE, CDC §19). */
  offreLibelle?: string;
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
    coupon: contexte?.couponCode ?? "",
    offre: contexte?.offreLibelle ?? "",
  };

  return template.replace(VARIABLE_REGEX, (match, nomVariable: string) => {
    const cle = nomVariable.toLowerCase();
    return valeurs[cle] ?? match;
  });
}

/** Liste des variables disponibles, pour l'aide contextuelle du formulaire de modèle. */
export const VARIABLES_DISPONIBLES = [
  "prenom", "nom", "agence", "dernier_achat", "montant", "points_fidelite", "date", "coupon", "offre",
] as const;
