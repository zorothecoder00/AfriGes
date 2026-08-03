// lib/comptabilite/immobilisations.ts
//
// Registre des immobilisations et calcul automatique des amortissements
// (CDC Comptabilité §22). Seule la méthode LINEAIRE est calculée pour le moment.
// Toute écriture générée ici passe par le moteur central (lib/comptabilite/moteur.ts)
// — mêmes garanties (équilibre, idempotence par référence, période clôturée).
import type { Prisma } from "@prisma/client";
import { creerEcriture } from "@/lib/comptabilite/moteur";

type TxClient = Prisma.TransactionClient;

/** Dotation mensuelle théorique (méthode linéaire), sans tenir compte du cumul déjà amorti. */
export function calculerDotationMensuelle(coutAcquisition: number, valeurResiduelle: number, dureeAnnees: number): number {
  const base = coutAcquisition - valeurResiduelle;
  const mois = dureeAnnees * 12;
  if (mois <= 0 || base <= 0) return 0;
  return Math.round((base / mois) * 100) / 100;
}

/** Écriture d'acquisition : Dr compte immobilisation / Cr Fournisseur ou Trésorerie. */
export async function ecritureAcquisitionImmobilisation(
  tx: TxClient,
  params: {
    montant: number;
    compteNumero: string;
    designation: string;
    reference: string;
    fournisseurNumero?: string | null;
    modePaiement?: string | null;
    userId: number;
    date: Date;
  },
): Promise<number | null> {
  const compteCredit =
    params.fournisseurNumero ??
    (["VIREMENT", "CHEQUE", "MOBILE_MONEY"].includes((params.modePaiement ?? "").toUpperCase()) ? "521" : "571");

  return creerEcriture(tx, {
    journal: "ACHATS",
    date: params.date,
    libelle: `Acquisition immobilisation — ${params.designation} — ${params.reference}`,
    userId: params.userId,
    reference: `SYNC-IMMO-ACQ-${params.reference}`,
    lignes: [
      { numero: params.compteNumero, debit: params.montant, libelle: params.designation },
      { numero: compteCredit, credit: params.montant, libelle: params.designation },
    ],
  });
}

/**
 * Génère (si pas déjà fait) la dotation d'amortissement d'une immobilisation pour
 * une période donnée, plafonnée pour ne jamais amortir sous la valeur résiduelle.
 * Idempotent : un second appel sur la même période ne recrée rien.
 */
export async function genererDotationPeriode(
  tx: TxClient,
  immobilisationId: number,
  annee: number,
  mois: number,
  userId: number,
): Promise<{ created: boolean; montant: number }> {
  const periode = `${annee}-${String(mois).padStart(2, "0")}`;
  const existing = await tx.ligneAmortissement.findUnique({
    where: { immobilisationId_periode: { immobilisationId, periode } },
    select: { id: true },
  });
  if (existing) return { created: false, montant: 0 };

  const immo = await tx.immobilisation.findUnique({
    where: { id: immobilisationId },
    include: {
      compte: { select: { numero: true } },
      compteAmortissement: { select: { numero: true } },
    },
  });
  if (!immo || immo.statut !== "EN_SERVICE") return { created: false, montant: 0 };
  // Les terrains ne se déprécient pas comptablement (règle OHADA).
  if (immo.categorie === "TERRAIN") return { created: false, montant: 0 };

  const periodeDate = new Date(annee, mois - 1, 1);
  const miseEnService = immo.dateMiseEnService;
  if (periodeDate < new Date(miseEnService.getFullYear(), miseEnService.getMonth(), 1)) {
    return { created: false, montant: 0 };
  }

  const coutAcquisition = Number(immo.coutAcquisition);
  const valeurResiduelle = Number(immo.valeurResiduelle);
  const cumulAvant = Number(immo.amortissementCumule);
  const amortissable = coutAcquisition - valeurResiduelle;
  const restant = Math.max(0, amortissable - cumulAvant);

  const dotationTheorique = calculerDotationMensuelle(coutAcquisition, valeurResiduelle, immo.dureeAnnees);
  const montant = Math.min(dotationTheorique, restant);
  if (montant <= 0) return { created: false, montant: 0 };

  const cumulApres = cumulAvant + montant;
  const vncApres = coutAcquisition - cumulApres;

  const ecritureId = await creerEcriture(tx, {
    journal: "OD",
    date: periodeDate,
    libelle: `Dotation amortissement ${periode} — ${immo.designation}`,
    userId,
    reference: `SYNC-IMMO-DOT-${immobilisationId}-${periode}`,
    lignes: [
      { numero: "681", debit: montant, libelle: immo.designation },
      { numero: immo.compteAmortissement.numero, credit: montant, libelle: immo.designation },
    ],
  });

  await tx.ligneAmortissement.create({
    data: { immobilisationId, periode, montantDotation: montant, cumulApres, vncApres, ecritureId: ecritureId ?? null },
  });

  await tx.immobilisation.update({
    where: { id: immobilisationId },
    data: {
      amortissementCumule: cumulApres,
      valeurNetteComptable: vncApres,
      statut: vncApres <= 0.01 ? "AMORTIE" : immo.statut,
    },
  });

  return { created: true, montant };
}

/** Génère les dotations d'une période pour toutes les immobilisations EN_SERVICE. */
export async function genererDotationsDuMois(
  tx: TxClient,
  annee: number,
  mois: number,
  userId: number,
): Promise<{ created: number; skipped: number; total: number }> {
  const immos = await tx.immobilisation.findMany({ where: { statut: "EN_SERVICE" }, select: { id: true } });
  let created = 0;
  let skipped = 0;
  for (const immo of immos) {
    const res = await genererDotationPeriode(tx, immo.id, annee, mois, userId);
    if (res.created) created++;
    else skipped++;
  }
  return { created, skipped, total: immos.length };
}

/**
 * Cession/sortie d'une immobilisation (CDC §22) : solde le compte d'amortissement
 * cumulé et le compte d'immobilisation, constate la VNC restante en charge (81) ;
 * si un prix de cession est renseigné, une seconde écriture constate le produit
 * de cession (82) en contrepartie caisse — volontairement séparée pour rester lisible.
 */
export async function ecritureSortieImmobilisation(
  tx: TxClient,
  immobilisationId: number,
  userId: number,
  prixCession?: number,
): Promise<void> {
  const immo = await tx.immobilisation.findUnique({
    where: { id: immobilisationId },
    include: { compte: { select: { numero: true } }, compteAmortissement: { select: { numero: true } } },
  });
  if (!immo) throw new Error("IMMOBILISATION_INTROUVABLE");
  if (immo.statut === "CEDEE") throw new Error("DEJA_CEDEE");

  const cout = Number(immo.coutAcquisition);
  const cumul = Number(immo.amortissementCumule);
  const vnc = Math.max(0, cout - cumul);

  const lignes: { numero: string; debit?: number; credit?: number; libelle: string }[] = [
    { numero: immo.compteAmortissement.numero, debit: cumul, libelle: `Solde amortissement — ${immo.designation}` },
  ];
  if (vnc > 0) lignes.push({ numero: "81", debit: vnc, libelle: `VNC sortie — ${immo.designation}` });
  lignes.push({ numero: immo.compte.numero, credit: cout, libelle: `Sortie — ${immo.designation}` });

  await creerEcriture(tx, {
    journal: "OD",
    date: new Date(),
    libelle: `Sortie immobilisation — ${immo.designation}`,
    userId,
    reference: `SYNC-IMMO-SORTIE-${immobilisationId}`,
    lignes,
  });

  if (prixCession != null && prixCession > 0) {
    await creerEcriture(tx, {
      journal: "OD",
      date: new Date(),
      libelle: `Cession immobilisation — ${immo.designation}`,
      userId,
      reference: `SYNC-IMMO-CESSION-${immobilisationId}`,
      lignes: [
        { numero: "571", debit: prixCession, libelle: `Cession ${immo.designation}` },
        { numero: "82", credit: prixCession, libelle: `Produit cession ${immo.designation}` },
      ],
    });
  }

  await tx.immobilisation.update({
    where: { id: immobilisationId },
    data: { statut: "CEDEE", dateCession: new Date(), prixCession: prixCession ?? null },
  });
}
