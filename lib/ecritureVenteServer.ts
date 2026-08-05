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
import { creerEcriture, resoudreRegleComptable, type ContexteEvenement, type LigneMoteur } from "@/lib/comptabilite/moteur";
import { resoudreTvaVente, decomposerTTC } from "@/lib/comptabilite/tva";

type TxClient = Prisma.TransactionClient;

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
      clientId: true,
      createdAt: true,
      pointDeVenteId: true,
    },
  });
  if (!vente) return;
  if (vente.modePaiement === "CREDIT") return;
  if (vente.statut === "BROUILLON" || vente.statut === "ANNULEE") return;

  const montant = Number(vente.montantPaye);
  if (montant <= 0) return;

  // CDC §54 — mode de paiement (compte de trésorerie), type client et point de
  // vente comme facteurs de résolution des comptes (avant : "571" câblé en dur
  // quel que soit le mode de paiement, aucune notion de type client/PDV).
  const client = vente.clientId != null
    ? await tx.client.findUnique({ where: { id: vente.clientId }, select: { typeClient: true } })
    : null;
  const ctx: ContexteEvenement = {
    modePaiement: vente.modePaiement,
    typeClient: client?.typeClient ?? null,
    pointDeVenteId: vente.pointDeVenteId,
  };
  const regle = await resoudreRegleComptable(tx, "VENTE_COMPTANT_DIRECTE", ctx);
  if (!regle) return;

  // TVA (CDC §21) : décomposition HT/TVA si une taxe TVA active est configurée
  // (onglet Exercices, Taxes & Récurrentes) ; sinon comportement inchangé.
  const tva = await resoudreTvaVente(tx);
  const lignes: LigneMoteur[] = tva
    ? (() => {
        const { montantHT, montantTVA } = decomposerTTC(montant, tva.taux);
        return [
          { numero: regle.compteDebitNumero, debit: montant, libelle: `VD ${vente.reference}`, pointDeVenteId: vente.pointDeVenteId },
          { numero: regle.compteCreditNumero, credit: montantHT, libelle: `VD ${vente.reference}`, pointDeVenteId: vente.pointDeVenteId },
          { numero: tva.compteCollecteNumero, credit: montantTVA, libelle: `TVA collectée ${vente.reference}`, isTva: true, tauxTva: tva.taux, montantTva: montantTVA, pointDeVenteId: vente.pointDeVenteId },
        ];
      })()
    : [
        { numero: regle.compteDebitNumero, debit: montant, libelle: `VD ${vente.reference}`, pointDeVenteId: vente.pointDeVenteId },
        { numero: regle.compteCreditNumero, credit: montant, libelle: `VD ${vente.reference}`, pointDeVenteId: vente.pointDeVenteId },
      ];

  await creerEcriture(tx, {
    reference: `SYNC-VD-${venteDirecteId}`,
    date: vente.createdAt,
    libelle: `Vente directe — ${vente.reference}${vente.clientNom ? ` — ${vente.clientNom}` : ""}`,
    journal: regle.journal,
    userId,
    lignes,
  });
}

/**
 * Sortie de stock / coût des marchandises vendues (COGS), constatée au moment
 * où le stock physique sort réellement — pour une vente comptant c'est la
 * création de la vente elle-même ; pour une vente à crédit, c'est la
 * confirmation de livraison par le magasinier (la validation du crédit ne
 * fait que RÉSERVER le stock, elle ne le sort pas). Avant cette fonction,
 * aucune écriture ne constatait cette sortie : le compte 311 Marchandises
 * était décrémenté en gestion de stock mais ne bougeait jamais en
 * comptabilité — Dr 6031 Variation de stocks / Cr 311 Marchandises comble ce
 * trou, au même titre qu'une vente comptant ou à crédit (le stock sort dans
 * les deux cas, seul l'encaissement diffère).
 *
 * Coût retenu : `Produit.prixAchat` au moment de l'appel (pas de FIFO/CUMP
 * réel) — même simplification assumée que dans
 * lib/comptabilite/rapportsGestion.ts pour le calcul de marge. Une ligne dont
 * le produit n'a pas de prixAchat connu (ou hors catalogue, produitId null)
 * est ignorée : jamais de coût fabriqué, elle reste simplement absente du COGS.
 */
export async function creerEcritureCogsVenteDirecte(
  tx: TxClient,
  venteDirecteId: number,
  userId: number,
): Promise<void> {
  const vente = await tx.venteDirecte.findUnique({
    where: { id: venteDirecteId },
    select: {
      reference: true,
      statut: true,
      createdAt: true,
      pointDeVenteId: true,
      lignes: { select: { produitId: true, quantite: true } },
    },
  });
  if (!vente) return;
  if (vente.statut === "BROUILLON" || vente.statut === "ANNULEE") return;

  const produitIds = [...new Set(vente.lignes.map((l) => l.produitId).filter((id): id is number => id != null))];
  if (produitIds.length === 0) return;

  const produits = await tx.produit.findMany({
    where: { id: { in: produitIds } },
    select: { id: true, prixAchat: true, categorie: true, categorieProduit: { select: { nom: true } } },
  });
  const infoParProduit = new Map(produits.map((p) => [
    p.id,
    { cout: p.prixAchat != null ? Number(p.prixAchat) : null, categorie: p.categorieProduit?.nom ?? p.categorie ?? null },
  ]));

  // CDC §6/§52/§53 — coût regroupé par PRODUIT (pas seulement catégorie) : chaque
  // produit résout sa propre cascade Produit > Catégorie > Famille > Config
  // générale (lib/comptabilite/comptesProduit.ts) via resoudreRegleComptable,
  // avant repli sur les mêmes 6031/311 par défaut (comportement inchangé pour
  // un produit non paramétré). Les lignes obtenues sont ensuite regroupées par
  // couple de comptes réellement résolu pour ne pas multiplier les lignes
  // d'écriture inutilement.
  const coutParProduit = new Map<number, number>();
  for (const l of vente.lignes) {
    if (l.produitId == null) continue;
    const info = infoParProduit.get(l.produitId);
    if (!info || info.cout == null) continue;
    coutParProduit.set(l.produitId, (coutParProduit.get(l.produitId) ?? 0) + l.quantite * info.cout);
  }
  if (coutParProduit.size === 0) return;

  const parCouple = new Map<string, { debit: string; credit: string; journal: string; montant: number }>();
  for (const [produitId, coutGroupe] of coutParProduit) {
    if (coutGroupe <= 0) continue;
    const info = infoParProduit.get(produitId);
    const regle = await resoudreRegleComptable(tx, "SORTIE_STOCK_VENTE", { categorie: info?.categorie ?? null, produitId, pointDeVenteId: vente.pointDeVenteId });
    if (!regle) continue;
    const cle = `${regle.compteDebitNumero}|${regle.compteCreditNumero}|${regle.journal}`;
    const existant = parCouple.get(cle);
    if (existant) existant.montant += coutGroupe;
    else parCouple.set(cle, { debit: regle.compteDebitNumero, credit: regle.compteCreditNumero, journal: regle.journal, montant: coutGroupe });
  }
  if (parCouple.size === 0) return;

  const lignes: LigneMoteur[] = [];
  let journal = "VENTES";
  for (const { debit, credit, journal: j, montant } of parCouple.values()) {
    journal = j;
    lignes.push(
      { numero: debit, debit: montant, libelle: `COGS ${vente.reference}`, pointDeVenteId: vente.pointDeVenteId },
      { numero: credit, credit: montant, libelle: `COGS ${vente.reference}`, pointDeVenteId: vente.pointDeVenteId },
    );
  }
  if (lignes.length === 0) return;

  await creerEcriture(tx, {
    reference: `SYNC-COGS-${venteDirecteId}`,
    date: vente.createdAt,
    journal,
    libelle: `Sortie de stock — ${vente.reference}`,
    userId,
    lignes,
  });
}
