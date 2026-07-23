import { Prisma } from "@prisma/client";

type TX = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

function genRefVersement(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ENC-${ymd}-${rand}`;
}

type SouscriptionAvecPack = {
  id: number;
  montantVerse: Prisma.Decimal | number;
  montantTotal: Prisma.Decimal | number;
  numeroCycle: number;
  formuleRevendeur: string | null;
  pack: { nom: string; type: string; acomptePercent: Prisma.Decimal | number | null };
};

/**
 * Impute un montant sur la souscription (montantVerse/montantRestant/statut/
 * numeroCycle) et les échéances en attente, en place. Logique identique à celle
 * utilisée par la confirmation caissier — extraite pour être partagée entre la
 * confirmation d'un versement EN_ATTENTE et l'encaissement instantané terrain.
 */
async function imputerSurSouscription(
  tx: TX,
  souscription: SouscriptionAvecPack,
  montantEffectif: number,
  datePaiement: Date,
): Promise<{ estSolde: boolean }> {
  const nouveauMontantVerse = Number(souscription.montantVerse) + montantEffectif;
  const nouveauMontantRestant = Number(souscription.montantTotal) - nouveauMontantVerse;
  const estSolde = nouveauMontantRestant <= 0.01;

  let nouveauStatut: string;
  if (estSolde) {
    nouveauStatut = "COMPLETE";
  } else if (souscription.pack.type === "REVENDEUR" && souscription.formuleRevendeur === "FORMULE_1") {
    const seuil50 = Number(souscription.montantTotal) * 0.5;
    nouveauStatut = nouveauMontantVerse >= seuil50 ? "ACTIF" : "EN_ATTENTE";
  } else if (souscription.pack.type === "URGENCE" && souscription.pack.acomptePercent) {
    const seuilAcompte = (Number(souscription.montantTotal) * Number(souscription.pack.acomptePercent)) / 100;
    nouveauStatut = nouveauMontantVerse >= seuilAcompte ? "ACTIF" : "EN_ATTENTE";
  } else {
    nouveauStatut = nouveauMontantVerse > 0 ? "ACTIF" : "EN_ATTENTE";
  }

  const nouveauCycle =
    estSolde && souscription.pack.type === "FAMILIAL"
      ? souscription.numeroCycle + 1
      : souscription.numeroCycle;

  await tx.souscriptionPack.update({
    where: { id: souscription.id },
    data: {
      montantVerse: nouveauMontantVerse,
      montantRestant: estSolde ? 0 : nouveauMontantRestant,
      statut: nouveauStatut as never,
      dateCloture: estSolde ? new Date() : null,
      numeroCycle: nouveauCycle,
    },
  });

  if (estSolde) {
    await tx.echeancePack.updateMany({
      where: { souscriptionId: souscription.id, statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
      data: { statut: "PAYE", datePaiement },
    });
  } else {
    const nonPayees = await tx.echeancePack.findMany({
      where: { souscriptionId: souscription.id, statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
      orderBy: { numero: "asc" },
    });
    const idsAPayer: number[] = [];
    let budget = montantEffectif;
    for (const ec of nonPayees) {
      if (budget >= Number(ec.montant) - 0.01) {
        idsAPayer.push(ec.id);
        budget -= Number(ec.montant);
      } else break;
    }
    if (idsAPayer.length === 0 && nonPayees.length > 0) idsAPayer.push(nonPayees[0].id);
    if (idsAPayer.length > 0) {
      await tx.echeancePack.updateMany({ where: { id: { in: idsAPayer } }, data: { statut: "PAYE", datePaiement } });
    }
  }

  return { estSolde };
}

async function creerOperationCaisseSiActive(
  tx: TX,
  caissierId: number,
  montantEffectif: number,
  motif: string,
  operateurNom: string,
): Promise<void> {
  const sessionActive = await tx.sessionCaisse.findFirst({
    where: { statut: { in: ["OUVERTE", "SUSPENDUE"] }, caissierId },
    orderBy: { createdAt: "desc" },
  });
  if (!sessionActive) return;
  await tx.operationCaisse.create({
    data: {
      sessionId: sessionActive.id,
      type: "ENCAISSEMENT",
      mode: "ESPECES",
      montant: new Prisma.Decimal(montantEffectif),
      motif,
      reference: genRefVersement(),
      operateurNom,
      operateurId: caissierId,
    },
  });
}

export interface ParamsVersementPack {
  souscriptionId: number;
  montant: number;
  modePaiement?: string;
  notes?: string | null;
  encaisseParId: number;
  encaisseParNom: string;
  datePaiement?: Date;
  /** true = effet financier immédiat (PAYE) ; false = EN_ATTENTE (confirmation caissier). */
  confirmer: boolean;
}

export type ResultatVersementPack =
  | { ok: true; versementId: number; montantEffectif: number; estSolde: boolean }
  | { ok: false; error: string };

/**
 * Crée un versement de pack dans une transaction existante.
 * - confirmer=false : crée le versement EN_ATTENTE (aucun effet financier).
 * - confirmer=true  : impute directement l'échéancier et la souscription
 *   (utilisé pour l'encaissement instantané de l'agent terrain).
 */
export async function enregistrerVersementPack(
  tx: TX,
  p: ParamsVersementPack,
): Promise<ResultatVersementPack> {
  const souscription = await tx.souscriptionPack.findUnique({
    where: { id: p.souscriptionId },
    include: { pack: true },
  });
  if (!souscription) return { ok: false, error: "Souscription introuvable" };
  if (["ANNULE", "COMPLETE"].includes(souscription.statut)) {
    return { ok: false, error: `Souscription déjà ${souscription.statut.toLowerCase()}` };
  }

  const montantEffectif = Math.min(Number(p.montant), Number(souscription.montantRestant));
  const datePaiement = p.datePaiement ?? new Date();

  const versement = await tx.versementPack.create({
    data: {
      souscriptionId: p.souscriptionId,
      type: "VERSEMENT_PERIODIQUE",
      montant: montantEffectif,
      statut: p.confirmer ? "PAYE" : "EN_ATTENTE",
      datePaiement,
      encaisseParId: p.encaisseParId,
      encaisseParNom: p.encaisseParNom,
      notes: p.notes ?? null,
    },
  });

  if (!p.confirmer) {
    return { ok: true, versementId: versement.id, montantEffectif, estSolde: false };
  }

  const { estSolde } = await imputerSurSouscription(tx, souscription, montantEffectif, datePaiement);
  return { ok: true, versementId: versement.id, montantEffectif, estSolde };
}

export type ResultatConfirmationVersement =
  | { ok: true; versementId: number; montantEffectif: number; estSolde: boolean }
  | { ok: false; error: string };

/**
 * Confirme un VersementPack EN_ATTENTE existant (créé par un agent terrain) :
 * bascule son statut à PAYE puis impute la souscription/les échéances. Crée une
 * OperationCaisse si le caissier confirmant a une session de caisse ouverte.
 * Reprend la logique historique de app/api/caissier/versements/[id]/confirmer.
 */
export async function confirmerVersementPackExistant(
  tx: TX,
  versementId: number,
  caissierId: number,
  caissierNom: string,
): Promise<ResultatConfirmationVersement> {
  const versement = await tx.versementPack.findUnique({
    where: { id: versementId },
    include: { souscription: { include: { pack: true } } },
  });
  if (!versement) return { ok: false, error: "Versement introuvable" };

  const souscription = versement.souscription;
  if (["ANNULE", "COMPLETE"].includes(souscription.statut)) {
    return { ok: false, error: `Souscription déjà ${souscription.statut.toLowerCase()}, impossible de confirmer` };
  }

  const montantEffectif = Number(versement.montant);
  await tx.versementPack.update({ where: { id: versementId }, data: { statut: "PAYE" } });

  const { estSolde } = await imputerSurSouscription(tx, souscription, montantEffectif, versement.datePaiement);

  await creerOperationCaisseSiActive(
    tx, caissierId, montantEffectif,
    `Versement pack confirmé — ${souscription.pack.nom} (${versement.encaisseParNom})`,
    caissierNom,
  );

  return { ok: true, versementId, montantEffectif, estSolde };
}
