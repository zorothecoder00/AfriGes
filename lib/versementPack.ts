import { Prisma } from "@prisma/client";
import { ecritureVersementPackConfirme } from "@/lib/comptabilite/ecrituresPack";

type TX = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

function nomClient(c: { nom: string; prenom: string } | null | undefined): string {
  return c ? `${c.prenom} ${c.nom}` : "Client";
}

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
    include: { pack: true, client: { select: { nom: true, prenom: true } } },
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

  await ecritureVersementPackConfirme(tx, {
    versementId: versement.id,
    montant: montantEffectif,
    packNom: souscription.pack.nom,
    clientNom: nomClient(souscription.client),
    modePaiement: p.modePaiement,
    userId: p.encaisseParId,
    date: datePaiement,
  });

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
    include: { souscription: { include: { pack: true, client: { select: { nom: true, prenom: true } } } } },
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

  await ecritureVersementPackConfirme(tx, {
    versementId: versement.id,
    montant: montantEffectif,
    packNom: souscription.pack.nom,
    clientNom: nomClient(souscription.client),
    modePaiement: "ESPECES",
    userId: caissierId,
    date: versement.datePaiement,
  });

  return { ok: true, versementId, montantEffectif, estSolde };
}

/**
 * Recalcule montantVerse/montantRestant/statut d'une souscription pack à
 * partir de la somme réelle de ses versements PAYE restants (pas d'un delta
 * incrémental comme `imputerSurSouscription`) — les versements EN_ATTENTE
 * n'ont aucun effet financier tant qu'ils ne sont pas confirmés, ils sont
 * donc exclus de l'agrégat, puis réaligne les échéances
 * (reset + re-marquage PAYE en ordre croissant selon le budget disponible).
 * Utilisé après correction du montant d'un versement ou suppression d'un
 * versement, pour ne jamais laisser la souscription/les échéances
 * désynchronisées des versements réellement présents en base.
 *
 * `dateReference` sert à horodater les échéances re-marquées PAYE ; à défaut,
 * la date du versement restant le plus récent est utilisée (now() si plus
 * aucun versement).
 */
export async function recalculerSouscriptionApresVersements(
  tx: TX,
  souscriptionId: number,
  dateReference?: Date
) {
  const souscription = await tx.souscriptionPack.findUniqueOrThrow({
    where: { id: souscriptionId },
    include: { pack: true },
  });

  const agg = await tx.versementPack.aggregate({
    where: { souscriptionId, statut: "PAYE" },
    _sum: { montant: true },
    _max: { datePaiement: true },
  });
  const nouveauMontantVerse = Number(agg._sum.montant ?? 0);
  const montantTotal = Number(souscription.montantTotal);
  const nouveauMontantRestant = montantTotal - nouveauMontantVerse;
  const estSolde = nouveauMontantRestant <= 0;
  const refDate = dateReference ?? agg._max.datePaiement ?? new Date();

  if (nouveauMontantVerse > montantTotal) {
    throw new Error(
      `Le montant corrigé dépasse le montant total de la souscription (${montantTotal.toLocaleString("fr-FR")} FCFA)`
    );
  }

  let nouveauStatut: string;
  if (estSolde) {
    nouveauStatut = "COMPLETE";
  } else if (souscription.pack.type === "REVENDEUR" && souscription.formuleRevendeur === "FORMULE_1") {
    const seuil50 = montantTotal * 0.5;
    nouveauStatut = nouveauMontantVerse >= seuil50 ? "ACTIF" : "EN_ATTENTE";
  } else if (souscription.pack.type === "URGENCE" && souscription.pack.acomptePercent) {
    const seuilAcompte = (montantTotal * Number(souscription.pack.acomptePercent)) / 100;
    nouveauStatut = nouveauMontantVerse >= seuilAcompte ? "ACTIF" : "EN_ATTENTE";
  } else {
    nouveauStatut = nouveauMontantVerse > 0 ? "ACTIF" : "EN_ATTENTE";
  }

  await tx.souscriptionPack.update({
    where: { id: souscriptionId },
    data: {
      montantVerse: nouveauMontantVerse,
      montantRestant: estSolde ? 0 : nouveauMontantRestant,
      statut: nouveauStatut as never,
      dateCloture: estSolde ? (souscription.dateCloture ?? new Date()) : null,
    },
  });

  const now = new Date();
  const toutesEcheances = await tx.echeancePack.findMany({
    where: { souscriptionId },
    orderBy: { numero: "asc" },
  });

  for (const ec of toutesEcheances) {
    await tx.echeancePack.update({
      where: { id: ec.id },
      data: {
        statut: new Date(ec.datePrevue) < now ? "EN_RETARD" : "EN_ATTENTE",
        datePaiement: null,
      },
    });
  }

  if (estSolde) {
    await tx.echeancePack.updateMany({
      where: { souscriptionId },
      data: { statut: "PAYE", datePaiement: refDate },
    });
  } else {
    const idsAPayer: number[] = [];
    let budget = nouveauMontantVerse;
    for (const ec of toutesEcheances) {
      if (budget >= Number(ec.montant) - 0.01) {
        idsAPayer.push(ec.id);
        budget -= Number(ec.montant);
      } else break;
    }
    // Budget partiel : marquer quand même la première échéance (paiement partiel).
    if (idsAPayer.length === 0 && toutesEcheances.length > 0 && nouveauMontantVerse > 0) {
      idsAPayer.push(toutesEcheances[0].id);
    }
    if (idsAPayer.length > 0) {
      await tx.echeancePack.updateMany({
        where: { id: { in: idsAPayer } },
        data: { statut: "PAYE", datePaiement: refDate },
      });
    }
  }

  return { montantVerse: nouveauMontantVerse, montantRestant: estSolde ? 0 : nouveauMontantRestant, statut: nouveauStatut };
}
