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
import { creerEcriture, resoudreRegleComptable, type LigneMoteur } from "@/lib/comptabilite/moteur";
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
      pointDeVenteId: true,
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
          { numero: COMPTE_CAISSE, debit: montant, libelle: `VD ${vente.reference}`, pointDeVenteId: vente.pointDeVenteId },
          { numero: COMPTE_VENTES, credit: montantHT, libelle: `VD ${vente.reference}`, pointDeVenteId: vente.pointDeVenteId },
          { numero: tva.compteCollecteNumero, credit: montantTVA, libelle: `TVA collectée ${vente.reference}`, isTva: true, tauxTva: tva.taux, montantTva: montantTVA, pointDeVenteId: vente.pointDeVenteId },
        ];
      })()
    : [
        { numero: COMPTE_CAISSE, debit: montant, libelle: `VD ${vente.reference}`, pointDeVenteId: vente.pointDeVenteId },
        { numero: COMPTE_VENTES, credit: montant, libelle: `VD ${vente.reference}`, pointDeVenteId: vente.pointDeVenteId },
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

  // CDC §6 — mapping automatique du compte stock/variation de stock par
  // catégorie de produit : le coût est regroupé par catégorie résolue, chaque
  // groupe résolvant ses propres comptes débit/crédit (une règle personnalisée
  // par catégorie l'emporte ; sans règle, tous les groupes retombent sur les
  // mêmes 6031/311, comportement inchangé).
  const coutParCategorie = new Map<string | null, number>();
  for (const l of vente.lignes) {
    if (l.produitId == null) continue;
    const info = infoParProduit.get(l.produitId);
    if (!info || info.cout == null) continue;
    const cle = info.categorie;
    coutParCategorie.set(cle, (coutParCategorie.get(cle) ?? 0) + l.quantite * info.cout);
  }
  if (coutParCategorie.size === 0) return;

  const lignes: LigneMoteur[] = [];
  let journal = "VENTES";
  for (const [categorie, coutGroupe] of coutParCategorie) {
    if (coutGroupe <= 0) continue;
    const regle = await resoudreRegleComptable(tx, "SORTIE_STOCK_VENTE", { categorie });
    if (!regle) continue;
    journal = regle.journal;
    lignes.push(
      { numero: regle.compteDebitNumero, debit: coutGroupe, libelle: `COGS ${vente.reference}`, pointDeVenteId: vente.pointDeVenteId },
      { numero: regle.compteCreditNumero, credit: coutGroupe, libelle: `COGS ${vente.reference}`, pointDeVenteId: vente.pointDeVenteId },
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
