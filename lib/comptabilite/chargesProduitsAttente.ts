// lib/comptabilite/chargesProduitsAttente.ts
//
// Charges à payer / produits à recevoir (CDC Comptabilité §27) — distinct des
// charges/produits constatés d'avance (lib/comptabilite/regularisationsAvance.ts,
// étalement d'une charge/produit déjà facturé sur plusieurs mois) : ici, la
// charge/le produit appartient à l'exercice en cours mais aucune facture n'est
// encore reçue/établie. Réutilise les comptes SYSCOHADA déjà provisionnés dans
// le plan comptable de base : 408 "Fournisseurs — Factures non reçues" et 418
// "Clients — Produits non encore facturés" — pas de nouveau compte à créer.
import type { Prisma } from "@prisma/client";
import { creerEcriture } from "@/lib/comptabilite/moteur";

type TxClient = Prisma.TransactionClient;

const COMPTE_CHARGE_A_PAYER_DEFAUT = "408";
const COMPTE_PRODUIT_A_RECEVOIR_DEFAUT = "418";

async function resoudreCompte(tx: TxClient, numero: string): Promise<number> {
  const compte = await tx.compteComptable.findUnique({ where: { numero }, select: { id: true } });
  if (!compte) throw new Error(`COMPTE_INTROUVABLE:${numero}`);
  return compte.id;
}

export interface CreerChargeProduitAttenteOpts {
  libelle: string;
  type: "CHARGE_A_PAYER" | "PRODUIT_A_RECEVOIR";
  compteChargeOuProduitNumero: string; // 6x (charge à payer) ou 7x (produit à recevoir)
  compteAttenteNumero?: string; // défaut : 408 ou 418 selon `type`
  montant: number;
  dateConstatation: Date;
  notes?: string | null;
}

/**
 * Constate immédiatement une charge à payer (Dr 6x / Cr 408) ou un produit à
 * recevoir (Dr 418 / Cr 7x) — la contrepartie 408/418 restera en compte
 * jusqu'à extourne (réception de la facture réelle, `extournerChargeProduitAttente`).
 */
export async function creerChargeProduitAttente(tx: TxClient, opts: CreerChargeProduitAttenteOpts, userId: number) {
  if (opts.montant <= 0) throw new Error("MONTANT_INVALIDE");
  const estChargeAPayer = opts.type === "CHARGE_A_PAYER";
  const compteAttenteNumero = opts.compteAttenteNumero || (estChargeAPayer ? COMPTE_CHARGE_A_PAYER_DEFAUT : COMPTE_PRODUIT_A_RECEVOIR_DEFAUT);

  const [compteChargeOuProduitId, compteAttenteId] = await Promise.all([
    resoudreCompte(tx, opts.compteChargeOuProduitNumero),
    resoudreCompte(tx, compteAttenteNumero),
  ]);

  const item = await tx.chargeProduitAttente.create({
    data: {
      libelle: opts.libelle, type: opts.type, montant: opts.montant,
      compteChargeOuProduitId, compteAttenteId,
      dateConstatation: opts.dateConstatation, notes: opts.notes ?? null,
      creeParId: userId,
    },
  });

  const ecritureConstatationId = await creerEcriture(tx, {
    journal: "OD",
    date: opts.dateConstatation,
    libelle: `${estChargeAPayer ? "Charge à payer" : "Produit à recevoir"} — ${opts.libelle}`,
    userId,
    reference: `SYNC-ATT-${item.id}`,
    lignes: estChargeAPayer
      ? [
          { numero: opts.compteChargeOuProduitNumero, debit: opts.montant, libelle: opts.libelle },
          { numero: compteAttenteNumero, credit: opts.montant, libelle: opts.libelle },
        ]
      : [
          { numero: compteAttenteNumero, debit: opts.montant, libelle: opts.libelle },
          { numero: opts.compteChargeOuProduitNumero, credit: opts.montant, libelle: opts.libelle },
        ],
  });

  await tx.chargeProduitAttente.update({ where: { id: item.id }, data: { ecritureConstatationId } });
  return item;
}

/**
 * Extourne (écriture inverse) une charge à payer / produit à recevoir dès
 * réception de la facture fournisseur réelle ou émission de la facture client
 * réelle — celle-ci se comptabilise alors normalement, sans double compte.
 */
export async function extournerChargeProduitAttente(tx: TxClient, id: number, userId: number, dateExtourne: Date = new Date()) {
  const item = await tx.chargeProduitAttente.findUnique({
    where: { id },
    include: { compteChargeOuProduit: { select: { numero: true } }, compteAttente: { select: { numero: true } } },
  });
  if (!item) throw new Error("ITEM_INTROUVABLE");
  if (item.statut === "EXTOURNEE") throw new Error("DEJA_EXTOURNEE");

  const estChargeAPayer = item.type === "CHARGE_A_PAYER";
  const montant = Number(item.montant);

  const ecritureExtourneId = await creerEcriture(tx, {
    journal: "OD",
    date: dateExtourne,
    libelle: `Extourne ${estChargeAPayer ? "charge à payer" : "produit à recevoir"} — ${item.libelle}`,
    userId,
    reference: `SYNC-ATT-EXT-${id}`,
    lignes: estChargeAPayer
      ? [
          { numero: item.compteAttente.numero, debit: montant, libelle: item.libelle },
          { numero: item.compteChargeOuProduit.numero, credit: montant, libelle: item.libelle },
        ]
      : [
          { numero: item.compteChargeOuProduit.numero, debit: montant, libelle: item.libelle },
          { numero: item.compteAttente.numero, credit: montant, libelle: item.libelle },
        ],
  });

  await tx.chargeProduitAttente.update({
    where: { id },
    data: { statut: "EXTOURNEE", ecritureExtourneId, dateExtourne },
  });

  return { ecritureExtourneId };
}
