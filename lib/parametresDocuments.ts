// lib/parametresDocuments.ts
// Seuils de validation paramétrables (CDC digitalisation §3.3/§3.4) — stockés dans
// le modèle générique `Parametre` (clé/valeur), comme les autres paramètres app
// (APP_NOM, etc.). Pas d'UI d'administration dédiée pour l'instant : modifiable en
// mettant à jour la ligne Parametre correspondante (upsert cle/valeur).

import { prisma } from "@/lib/prisma";

const DEFAUT_SEUIL_VISA_CGT_BON_COMMANDE = 500_000; // FCFA — CDC §3.1 (repris pour §3.3)
const DEFAUT_SEUIL_VISA_BON_SORTIE = 500_000; // FCFA — CDC §3.4 ("seuil optionnel")
const DEFAUT_SEUIL_VISA_CGT_BORDEREAU_REMISE = 500_000; // FCFA — CDC §3.1
const DEFAUT_SEUIL_REMISE_COMMANDE_CLIENT = 0; // FCFA — toute remise déclenche le visa RVC par défaut (CDC §3.2)
const DEFAUT_SEUIL_APPROBATION_N2_DECAISSEMENT = 500_000; // FCFA — CDC §3.6
const DEFAUT_SEUIL_VISA_DEMANDE_ACHAT = 500_000; // FCFA — CDC §5.3

async function lireSeuil(cle: string, defaut: number): Promise<number> {
  const p = await prisma.parametre.findUnique({ where: { cle } });
  const n = p ? Number(p.valeur) : NaN;
  return Number.isFinite(n) && n > 0 ? n : defaut;
}

/** Seuil au-delà duquel le Bon de Commande Fournisseur requiert un visa CGT avant envoi. */
export async function getSeuilVisaCGTBonCommande(): Promise<number> {
  return lireSeuil("SEUIL_VISA_CGT_BON_COMMANDE", DEFAUT_SEUIL_VISA_CGT_BON_COMMANDE);
}

/** Seuil (valorisation) au-delà duquel un Bon de Sortie requiert un visa avant exécution. */
export async function getSeuilVisaBonSortie(): Promise<number> {
  return lireSeuil("SEUIL_VISA_BON_SORTIE", DEFAUT_SEUIL_VISA_BON_SORTIE);
}

/** Seuil au-delà duquel un Bordereau de Remise de Fonds requiert un visa CGT avant clôture. */
export async function getSeuilVisaCGTBordereauRemise(): Promise<number> {
  return lireSeuil("SEUIL_VISA_CGT_BORDEREAU_REMISE", DEFAUT_SEUIL_VISA_CGT_BORDEREAU_REMISE);
}

/** Seuil (montant total de remise) au-delà duquel un Bon de Commande Client requiert le visa RVC. */
export async function getSeuilRemiseCommandeClient(): Promise<number> {
  return lireSeuil("SEUIL_REMISE_COMMANDE_CLIENT", DEFAUT_SEUIL_REMISE_COMMANDE_CLIENT);
}

/** Seuil au-delà duquel une Fiche de Décaissement requiert l'approbation N2 (Direction/Finance). */
export async function getSeuilApprobationN2Decaissement(): Promise<number> {
  return lireSeuil("SEUIL_APPROBATION_N2_DECAISSEMENT", DEFAUT_SEUIL_APPROBATION_N2_DECAISSEMENT);
}

/** Seuil (valorisation) au-delà duquel une Demande d'Achat Interne requiert un visa avant approbation. */
export async function getSeuilVisaDemandeAchat(): Promise<number> {
  return lireSeuil("SEUIL_VISA_DEMANDE_ACHAT", DEFAUT_SEUIL_VISA_DEMANDE_ACHAT);
}
