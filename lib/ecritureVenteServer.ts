/**
 * lib/ecritureVenteServer.ts — Écriture comptable automatique à la création
 * d'une vente comptant (CDC Comptabilité §8/§54 — "de l'argent qui bouge sans
 * écriture" doit être fermé à la source, pas seulement en rattrapage).
 *
 * Avant : seule la synchronisation manuelle (`/api/comptable/sync-journals`,
 * fonction `syncVentesDirectes`) générait cette écriture, à la demande du
 * comptable. Cette fonction reprend exactement la même logique (même
 * référence `SYNC-VD-{id}`, même compte Caisse/Ventes, même montant
 * `montantPaye`) mais est appelée directement dans la transaction de création
 * de la vente, pour que l'écriture existe dès l'encaissement. La
 * synchronisation manuelle reste disponible en rattrapage (elle ignore
 * silencieusement les références déjà créées, donc aucun doublon).
 *
 * Les ventes à crédit (modePaiement === "CREDIT") ne sont jamais concernées
 * ici : elles sont comptabilisées via CreditClient/RemboursementCredit
 * (lib/comptabilite/moteur.ts::ecritureVenteCreditValidee).
 */
import type { Prisma } from "@prisma/client";
import { creerEcriture, type LigneMoteur } from "@/lib/comptabilite/moteur";
import { resoudreTvaVente, decomposerTTC } from "@/lib/comptabilite/tva";

type TxClient = Prisma.TransactionClient;

const COMPTE_CAISSE = "571";
const COMPTE_VENTES = "701";

export async function creerEcritureVenteDepuisVenteDirecte(
  tx: TxClient,
  venteDirecteId: number,
  userId: number,
): Promise<void> {
  const vente = await tx.venteDirecte.findUnique({
    where: { id: venteDirecteId },
    select: {
      reference: true,
      statut: true,
      modePaiement: true,
      montantPaye: true,
      clientNom: true,
      createdAt: true,
    },
  });
  if (!vente) return;
  if (vente.modePaiement === "CREDIT") return;
  if (vente.statut === "BROUILLON" || vente.statut === "ANNULEE") return;

  const montant = Number(vente.montantPaye);
  if (montant <= 0) return;

  // TVA (CDC §21) : décomposition HT/TVA si une taxe TVA active est configurée
  // (onglet Exercices, Taxes & Récurrentes) ; sinon comportement inchangé.
  const tva = await resoudreTvaVente(tx);
  const lignes: LigneMoteur[] = tva
    ? (() => {
        const { montantHT, montantTVA } = decomposerTTC(montant, tva.taux);
        return [
          { numero: COMPTE_CAISSE, debit: montant, libelle: `VD ${vente.reference}` },
          { numero: COMPTE_VENTES, credit: montantHT, libelle: `VD ${vente.reference}` },
          { numero: tva.compteCollecteNumero, credit: montantTVA, libelle: `TVA collectée ${vente.reference}`, isTva: true, tauxTva: tva.taux, montantTva: montantTVA },
        ];
      })()
    : [
        { numero: COMPTE_CAISSE, debit: montant, libelle: `VD ${vente.reference}` },
        { numero: COMPTE_VENTES, credit: montant, libelle: `VD ${vente.reference}` },
      ];

  await creerEcriture(tx, {
    reference: `SYNC-VD-${venteDirecteId}`,
    date: vente.createdAt,
    libelle: `Vente directe — ${vente.reference}${vente.clientNom ? ` — ${vente.clientNom}` : ""}`,
    journal: "VENTES",
    userId,
    lignes,
  });
}
