// lib/comptabilite/societe.ts
//
// Multi-société (CDC §50) et multi-devise (CDC §49) — architecture prête, une
// seule société active aujourd'hui (AfriSime SARL, XOF). Le moteur comptable
// résout toujours la société principale par défaut quand l'appelant ne précise
// rien, pour un zéro régression sur tous les points d'intégration existants.
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

/**
 * Société principale, auto-créée au premier appel à partir de la
 * ConfigurationComptableInitiale (CDC §60) si elle n'existe pas encore — pour
 * ne jamais dupliquer la saisie pays/devise/référentiel à deux endroits.
 */
export async function getOuCreerSocietePrincipale(tx: TxClient) {
  const existante = await tx.societe.findFirst({ where: { estPrincipale: true } });
  if (existante) return existante;

  const config = await tx.configurationComptableInitiale.findUnique({ where: { id: 1 } });
  return tx.societe.create({
    data: {
      nom: "AfriSime SARL",
      pays: config?.pays ?? "Togo",
      deviseFonctionnelleCode: config?.devise ?? "XOF",
      referentielComptable: config?.referentiel ?? "SYSCOHADA révisé",
      typeEntite: config?.typeEntite ?? "Société commerciale",
      estPrincipale: true,
    },
  });
}

export async function resoudreSocietePrincipaleId(tx: TxClient): Promise<number> {
  const societe = await getOuCreerSocietePrincipale(tx);
  return societe.id;
}

/** Devise fonctionnelle active, auto-créée (taux=1) si absente du référentiel. */
export async function getOuCreerDeviseFonctionnelle(tx: TxClient, code = "XOF") {
  const existante = await tx.devise.findUnique({ where: { code } });
  if (existante) return existante;
  return tx.devise.create({
    data: { code, nom: code === "XOF" ? "Franc CFA (BCEAO)" : code, symbole: code === "XOF" ? "FCFA" : code, tauxVersFonctionnelle: 1 },
  });
}
