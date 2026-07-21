// lib/compteCourant.ts
// Helpers du module Compte Courant client :
//  - génération du numéro de compte (12 chiffres, commence par « 12 »)
//  - calcul de la clé RIB (contrôle type modulo 97)
//  - format du RIB complet affiché
//  - chargement du paramétrage (singleton)

import { prisma } from "@/lib/prisma";
import { Prisma, PrioriteNotification, TypePaiement, type NatureMouvementCC, type TypeJournalComptable } from "@prisma/client";
import { notifyAdmins } from "@/lib/notifications";
import { enregistrerRemboursementCredit } from "@/lib/remboursementCredit";
import { attribuerPointsDepot } from "@/lib/fidelite";

export type TxClient = Prisma.TransactionClient;

/** Préfixe imposé par le CDC : tout numéro commence par 12. */
export const NUMERO_PREFIX = "12";
export const NUMERO_LONGUEUR = 12;

/**
 * Extrait les métadonnées de traçabilité d'une requête (CDC §16) : adresse IP et
 * machine (user-agent) de l'auteur, à journaliser sur chaque opération sensible.
 */
export function extraireMetaRequete(req: Request): { ip: string | null; userAgent: string | null } {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) || null;
  return { ip, userAgent };
}

/**
 * Numéro de compte à 12 chiffres = "12" + 10 chiffres séquentiels zéro-paddés.
 * `seq` est un entier ≥ 1 (unicité garantie par la contrainte @unique en base,
 * avec retry côté endpoint en cas de collision concurrente).
 */
export function genererNumeroCompte(seq: number): string {
  const corps = String(seq).padStart(NUMERO_LONGUEUR - NUMERO_PREFIX.length, "0");
  return `${NUMERO_PREFIX}${corps}`;
}

/**
 * Clé RIB sur 2 chiffres, dérivée du numéro à 12 chiffres (contrôle de saisie).
 * clé = 97 − (numéro mod 97), dans [1..97].
 */
export function calculerCleRib(numeroCompte: string): string {
  // Le numéro tient sur 12 chiffres (< 2^53) → calcul exact en Number.
  const reste = Number(numeroCompte) % 97;
  const cle = 97 - reste; // ∈ [1..97]
  return String(cle).padStart(2, "0");
}

/** RIB complet affiché, ex : « TG-228 Afrs001 120000000001 96 ». */
export function formatRibComplet(
  codeAgence: string,
  codeGuichet: string,
  numeroCompte: string,
  cleRib: string,
): string {
  return `${codeAgence} ${codeGuichet} ${numeroCompte} ${cleRib}`;
}

/**
 * Charge le paramétrage du module (enregistrement unique id=1), en le créant
 * avec les valeurs par défaut du schéma s'il n'existe pas encore.
 */
export async function chargerParametrageCC() {
  const existant = await prisma.parametrageCompteCourant.findUnique({ where: { id: 1 } });
  if (existant) return existant;
  return prisma.parametrageCompteCourant.create({ data: { id: 1 } });
}

/** Référence unique d'un mouvement, ex : « DEP-20260706-00042 ». */
export async function genererReferenceMouvementCC(tx: TxClient, prefix = "MVT"): Promise<string> {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const count = await tx.mouvementCompteCourant.count();
  return `${prefix}-${ymd}-${String(count + 1).padStart(5, "0")}`;
}

async function genererReferenceEcriture(tx: TxClient, journal: string): Promise<string> {
  const prefix = journal.slice(0, 3).toUpperCase();
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const count = await tx.ecritureComptable.count();
  return `${prefix}-${ym}-${String(count + 1).padStart(5, "0")}`;
}

export interface LigneEcritureCC { numero: string; debit?: number; credit?: number; libelle?: string }

/**
 * Crée une écriture comptable (BROUILLON) équilibrée à partir de numéros de compte.
 * Renvoie l'id de l'écriture, ou null si un compte du plan comptable est absent
 * (le mouvement reste enregistré ; l'écriture pourra être régularisée manuellement).
 */
export async function creerEcritureCC(
  tx: TxClient,
  opts: { journal: TypeJournalComptable; date: Date; libelle: string; userId: number; lignes: LigneEcritureCC[] },
): Promise<number | null> {
  const numeros = [...new Set(opts.lignes.map((l) => l.numero))];
  const comptes = await tx.compteComptable.findMany({
    where: { numero: { in: numeros } },
    select: { id: true, numero: true },
  });
  const map = new Map(comptes.map((c) => [c.numero, c.id]));
  if (opts.lignes.some((l) => !map.has(l.numero))) return null;

  const reference = await genererReferenceEcriture(tx, opts.journal);
  const ecriture = await tx.ecritureComptable.create({
    data: {
      reference, date: opts.date, libelle: opts.libelle, journal: opts.journal,
      statut: "BROUILLON", userId: opts.userId,
      lignes: {
        create: opts.lignes.map((l) => ({
          compteId: map.get(l.numero)!,
          libelle:  l.libelle ?? opts.libelle,
          debit:    new Prisma.Decimal(l.debit ?? 0),
          credit:   new Prisma.Decimal(l.credit ?? 0),
        })),
      },
    },
    select: { id: true },
  });
  return ecriture.id;
}

/**
 * Enregistre un dépôt (mouvement DEPOT) sur un compte courant dans la transaction
 * `tx` : écriture comptable Débit Caisse / Crédit Compte courant client, ligne au
 * grand livre, et mise à jour du solde + totaux du compte. Mutualisé entre le dépôt
 * courant (CDC §5) et le dépôt d'ouverture (CDC §2).
 *
 * Ne fait aucune validation métier (min/max, statut) : l'appelant les assure.
 */
export async function enregistrerDepotCC(
  tx: TxClient,
  opts: {
    compteId: number;
    numeroCompte: string;
    codeAgence: string;
    clientNom: string;
    montant: number;
    userId: number;
    param: { compteCaisseNumero: string; compteCourantClientNumero: string };
    modePaiement?: string | null;
    observation?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    ouverture?: boolean;
    planEpargneId?: number | null; // cotisation fléchée vers un plan d'épargne programmée (CDC §19.B)
    numeroJour?: number | null;    // n° de jour de collecte (optionnel, parité crédits)
    dateOperation?: Date | null;   // date effective du dépôt si différente (optionnel)
    agentApporteurId?: number | null; // agent ayant physiquement apporté le dépôt (optionnel)
  },
) {
  // Relecture du solde dans la transaction (cohérence).
  const courant = await tx.compteCourant.findUnique({ where: { id: opts.compteId }, select: { solde: true, clientId: true } });
  const avant = Number(courant?.solde ?? 0);
  const apres = avant + opts.montant;

  const libelleNature = opts.ouverture ? "Dépôt d'ouverture" : "Dépôt";
  const ecritureId = await creerEcritureCC(tx, {
    journal: "CAISSE",
    date: new Date(),
    libelle: `${libelleNature} compte courant ${opts.numeroCompte} — ${opts.clientNom}`,
    userId: opts.userId,
    lignes: [
      { numero: opts.param.compteCaisseNumero,        debit:  opts.montant, libelle: `Encaissement ${libelleNature.toLowerCase()} CC` },
      { numero: opts.param.compteCourantClientNumero, credit: opts.montant, libelle: `${libelleNature} ${opts.numeroCompte}` },
    ],
  });

  const reference = await genererReferenceMouvementCC(tx, "DEP");
  const agenceOp = (await resoudreAgenceOperation(tx, opts.userId)) ?? opts.codeAgence;
  const mouvement = await tx.mouvementCompteCourant.create({
    data: {
      reference, compteId: opts.compteId, nature: "DEPOT",
      montant: opts.montant, soldeAvant: avant, soldeApres: apres,
      modePaiement: opts.modePaiement ?? null, observation: opts.observation ?? null,
      statut: "VALIDE", userId: opts.userId, agence: agenceOp, ecritureId,
      planEpargneId: opts.planEpargneId ?? null,
      numeroJour: opts.numeroJour ?? null,
      dateOperation: opts.dateOperation ?? null,
      agentApporteurId: opts.agentApporteurId ?? null,
      ip: opts.ip ?? null, userAgent: opts.userAgent ?? null,
    },
    select: { id: true, reference: true, createdAt: true },
  });

  await tx.compteCourant.update({
    where: { id: opts.compteId },
    data: {
      solde: apres,
      totalDepose: { increment: opts.montant },
      nbMouvements: { increment: 1 },
      derniereOperationAt: new Date(),
    },
  });

  // Récompenses de fidélité (CDC §19.D) : le titulaire gagne des points sur le dépôt.
  let fidelite: { points: number; niveauMonte: boolean } | null = null;
  if (courant?.clientId != null) {
    const r = await attribuerPointsDepot(tx, { clientId: courant.clientId, montant: opts.montant, mouvementId: mouvement.id });
    if (r) fidelite = { points: r.points, niveauMonte: r.niveauMonte };
  }

  return { mouvement, soldeAvant: avant, soldeApres: apres, ecritureGeneree: ecritureId != null, fidelite };
}

/**
 * Suspension automatique des comptes ACTIF sans opération depuis
 * `dureeInactiviteJours` (CDC §4). Passe le compte en SUSPENDU avec motif,
 * journalise (audit système, sans userId) et notifie les admins.
 * Appelable via le cron ou en mode « lazy » depuis une page d'administration.
 */
export async function suspendreComptesInactifs(): Promise<{ verifies: number; suspendus: number }> {
  const param = await chargerParametrageCC();
  const jours = param.dureeInactiviteJours;
  if (!jours || jours <= 0) return { verifies: 0, suspendus: 0 };

  const seuil = new Date();
  seuil.setDate(seuil.getDate() - jours);

  // ACTIF dont la dernière opération (ou l'ouverture si aucune) est antérieure au seuil.
  const candidats = await prisma.compteCourant.findMany({
    where: {
      statut: "ACTIF",
      OR: [
        { derniereOperationAt: { lt: seuil } },
        { derniereOperationAt: null, dateOuverture: { lt: seuil } },
      ],
    },
    select: { id: true, numeroCompte: true, client: { select: { prenom: true, nom: true } } },
  });

  for (const cc of candidats) {
    await prisma.$transaction(async (tx) => {
      await tx.compteCourant.update({
        where: { id: cc.id },
        data: { statut: "SUSPENDU", motifBlocage: `Inactivité supérieure à ${jours} jours (suspension automatique)` },
      });
      await tx.auditLog.create({
        data: {
          action: "SUSPENSION_AUTO_INACTIVITE", entite: "CompteCourant", entiteId: cc.id,
          details: { jours, seuil: seuil.toISOString() },
        },
      });
      await notifyAdmins(tx, {
        titre: "Compte courant suspendu (inactivité)",
        message: `Le compte ${cc.numeroCompte} (${cc.client.prenom} ${cc.client.nom}) a été suspendu automatiquement après ${jours} jours sans opération.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/comptes-courants/${cc.id}`,
      });
    });
  }

  return { verifies: candidats.length, suspendus: candidats.length };
}

/**
 * Alerte « faible solde » (CDC §14) : notifie (in-app, priorité HAUTE) lorsqu'une
 * opération laisse le solde du compte sous le seuil minimum obligatoire. À appeler
 * dans la transaction, après toute sortie de fonds (retrait, paiement crédit/comptant).
 * Ne fait rien si le seuil n'est pas atteint (solde encore suffisant).
 */
export async function alerterSoldeFaible(
  tx: TxClient,
  opts: { compteId: number; numeroCompte: string; clientNom: string; soldeApres: number; seuil: number },
): Promise<void> {
  if (!opts.seuil || opts.seuil <= 0) return;
  if (opts.soldeApres >= opts.seuil) return;
  await notifyAdmins(tx, {
    titre: "Alerte solde faible — compte courant",
    message: `Le solde du compte ${opts.numeroCompte} (${opts.clientNom}) est de ${opts.soldeApres.toLocaleString("fr-FR")} FCFA, sous le seuil minimum de ${opts.seuil.toLocaleString("fr-FR")} FCFA.`,
    priorite: PrioriteNotification.HAUTE,
    actionUrl: `/dashboard/admin/comptes-courants/${opts.compteId}`,
  });
}

/**
 * Alerte préventive « avant suspension » (CDC §14) : notifie les comptes ACTIF qui
 * seront suspendus pour inactivité dans `joursAlerteAvantSuspension` jours. Conçu pour
 * un cron quotidien : n'alerte chaque compte qu'une seule fois grâce à une bande d'un
 * jour (dernière opération datée d'exactement `dureeInactiviteJours − délai` jours).
 */
export async function alerterComptesAvantSuspension(): Promise<{ alertes: number }> {
  const param = await chargerParametrageCC();
  const jours = param.dureeInactiviteJours;
  const lead = param.joursAlerteAvantSuspension;
  if (!jours || jours <= 0 || !lead || lead <= 0 || lead >= jours) return { alertes: 0 };

  // Un compte est suspendu quand son inactivité atteint `jours`. On alerte quand il
  // reste `lead` jours : dernière opération dans la bande [borne−1j, borne[ où
  // borne = maintenant − (jours − lead). La bande d'un jour évite les doublons.
  const bandeFin = new Date();
  bandeFin.setDate(bandeFin.getDate() - (jours - lead));
  const bandeDebut = new Date(bandeFin);
  bandeDebut.setDate(bandeDebut.getDate() - 1);

  const candidats = await prisma.compteCourant.findMany({
    where: {
      statut: "ACTIF",
      OR: [
        { derniereOperationAt: { gte: bandeDebut, lt: bandeFin } },
        { derniereOperationAt: null, dateOuverture: { gte: bandeDebut, lt: bandeFin } },
      ],
    },
    select: { id: true, numeroCompte: true, client: { select: { prenom: true, nom: true } } },
  });

  for (const cc of candidats) {
    await prisma.$transaction(async (tx) => {
      await notifyAdmins(tx, {
        titre: "Compte courant bientôt suspendu (inactivité)",
        message: `Le compte ${cc.numeroCompte} (${cc.client.prenom} ${cc.client.nom}) sera suspendu dans ${lead} jour(s) faute d'opération. Pensez à contacter le client.`,
        priorite: PrioriteNotification.HAUTE,
        actionUrl: `/dashboard/admin/comptes-courants/${cc.id}`,
      });
      await tx.auditLog.create({
        data: { action: "ALERTE_AVANT_SUSPENSION_CC", entite: "CompteCourant", entiteId: cc.id, details: { lead, jours } },
      });
    });
  }

  return { alertes: candidats.length };
}

/**
 * Montant d'épargne actuellement bloqué (indisponible) sur un compte (CDC §19.E) :
 * somme des blocages ACTIF dont l'échéance n'est pas encore atteinte. Ce montant
 * est déduit du solde disponible pour toute sortie (retrait, paiement, prélèvement).
 * Accepte le client Prisma global ou une transaction.
 */
export async function montantBloqueActif(db: TxClient, compteId: number, now: Date = new Date()): Promise<number> {
  const agg = await db.blocageEpargne.aggregate({
    where: { compteId, statut: "ACTIF", dateDeblocage: { gt: now } },
    _sum: { montant: true },
  });
  return Number(agg._sum.montant ?? 0);
}

/**
 * Libération automatique des blocages d'épargne échus (CDC §19.E, cron / lazy) :
 * passe en LIBERE tout blocage ACTIF dont l'échéance est atteinte, journalise et
 * notifie les admins. Les fonds redeviennent alors disponibles.
 */
export async function libererBlocagesEchus(): Promise<{ liberes: number }> {
  const now = new Date();
  const echus = await prisma.blocageEpargne.findMany({
    where: { statut: "ACTIF", dateDeblocage: { lte: now } },
    select: {
      id: true, montant: true,
      compte: { select: { id: true, numeroCompte: true, libelle: true, client: { select: { prenom: true, nom: true } } } },
    },
  });

  for (const b of echus) {
    await prisma.$transaction(async (tx) => {
      await tx.blocageEpargne.update({ where: { id: b.id }, data: { statut: "LIBERE", libereLe: now } });
      await tx.auditLog.create({
        data: { action: "LIBERATION_BLOCAGE_EPARGNE", entite: "BlocageEpargne", entiteId: b.id, details: { montant: Number(b.montant) } },
      });
      const nom = b.compte.libelle ?? `${b.compte.client.prenom} ${b.compte.client.nom}`;
      await notifyAdmins(tx, {
        titre: "Épargne bloquée libérée",
        message: `${Number(b.montant).toLocaleString("fr-FR")} FCFA d'épargne bloquée arrivés à échéance sur le compte ${b.compte.numeroCompte} (${nom}) — fonds à nouveau disponibles.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/comptes-courants/${b.compte.id}`,
      });
    });
  }

  return { liberes: echus.length };
}

/**
 * Agence où une opération est effectuée (CDC §19.F — multi-agences) : nom du
 * point de vente d'affectation active de l'opérateur. Le compte est utilisable
 * dans toutes les agences ; chaque mouvement mémorise l'agence d'exécution.
 * Renvoie null si l'opérateur n'a pas d'affectation active (→ l'appelant retombe
 * sur l'agence de domiciliation du compte).
 */
export async function resoudreAgenceOperation(db: TxClient, userId: number): Promise<string | null> {
  const aff = await db.gestionnaireAffectation.findFirst({
    where: { userId, actif: true },
    orderBy: { dateDebut: "desc" },
    select: { pointDeVente: { select: { nom: true } } },
  });
  return aff?.pointDeVente?.nom ?? null;
}

/**
 * Compte courant INDIVIDUEL d'un client (ou null), pour le pré-contrôle POS et le lookup.
 * Les comptes collectifs (ménage/communauté/groupement) ne sont pas utilisés pour le
 * paiement personnel automatique (CDC §19.A) : on cible le compte propre du client.
 */
export async function getCompteCourantParClient(clientId: number) {
  return prisma.compteCourant.findFirst({
    where: { clientId, typeCompte: "INDIVIDUEL" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, numeroCompte: true, ribComplet: true, statut: true, solde: true, codeAgence: true,
      client: { select: { prenom: true, nom: true } },
    },
  });
}

/** Erreurs métier du prélèvement CC sur vente comptant. */
export type CCVenteError = "CC_ABSENT" | "CC_INACTIF" | "CC_SOLDE_INSUFFISANT";

/**
 * Débite le compte courant d'un client pour régler tout ou partie d'un achat
 * (CDC §3, §8) : mouvement (PAIEMENT_COMPTANT par défaut) + écriture Débit Compte
 * courant (419) / Crédit Ventes (701), lié à la vente OU au crédit client concerné.
 * Lève une CCVenteError si le compte est absent, non ACTIF, ou de solde insuffisant.
 *
 * Usages : vente comptant (venteId) et apport initial d'un crédit client (creditId).
 */
export async function preleverCompteCourant(
  tx: TxClient,
  opts: {
    clientId: number; montant: number;
    userId: number; ip?: string | null; userAgent?: string | null; refLibelle: string;
    nature?: NatureMouvementCC; venteId?: number; creditId?: number;
    param: { compteCourantClientNumero: string; compteVentesNumero: string; soldeMinObligatoire?: Prisma.Decimal | number | null };
  },
) {
  const cc = await tx.compteCourant.findFirst({
    where: { clientId: opts.clientId, typeCompte: "INDIVIDUEL" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, numeroCompte: true, statut: true, solde: true, codeAgence: true,
      client: { select: { prenom: true, nom: true } },
    },
  });
  if (!cc) throw new Error("CC_ABSENT");
  if (cc.statut !== "ACTIF") throw new Error("CC_INACTIF");
  const avant = Number(cc.solde);
  // Épargne bloquée (CDC §19.E) : indisponible pour un paiement.
  const bloque = await montantBloqueActif(tx, cc.id);
  if (opts.montant > avant - bloque) throw new Error("CC_SOLDE_INSUFFISANT");
  const apres = avant - opts.montant;
  const clientNom = `${cc.client.prenom} ${cc.client.nom}`;

  const ecritureId = await creerEcritureCC(tx, {
    journal: "OD", date: new Date(),
    libelle: `${opts.refLibelle} réglé via compte courant ${cc.numeroCompte} — ${clientNom}`,
    userId: opts.userId,
    lignes: [
      { numero: opts.param.compteCourantClientNumero, debit:  opts.montant, libelle: `Utilisation CC ${cc.numeroCompte}` },
      { numero: opts.param.compteVentesNumero,        credit: opts.montant, libelle: opts.refLibelle },
    ],
  });

  const reference = await genererReferenceMouvementCC(tx, "PAY");
  const agenceOp = (await resoudreAgenceOperation(tx, opts.userId)) ?? cc.codeAgence;
  const mouvement = await tx.mouvementCompteCourant.create({
    data: {
      reference, compteId: cc.id, nature: opts.nature ?? "PAIEMENT_COMPTANT",
      montant: -opts.montant, soldeAvant: avant, soldeApres: apres,
      observation: opts.refLibelle,
      statut: "VALIDE", userId: opts.userId, agence: agenceOp,
      ecritureId, venteId: opts.venteId ?? null, creditId: opts.creditId ?? null,
      ip: opts.ip ?? null, userAgent: opts.userAgent ?? null,
    },
    select: { id: true, reference: true },
  });

  await tx.compteCourant.update({
    where: { id: cc.id },
    data: {
      solde: apres,
      totalUtilise: { increment: opts.montant },
      nbMouvements: { increment: 1 },
      derniereOperationAt: new Date(),
    },
  });

  // Alerte préventive « faible solde » (CDC §14).
  await alerterSoldeFaible(tx, {
    compteId: cc.id, numeroCompte: cc.numeroCompte, clientNom,
    soldeApres: apres, seuil: Number(opts.param.soldeMinObligatoire ?? 0),
  });

  return { mouvement, compteId: cc.id, numeroCompte: cc.numeroCompte, soldeApres: apres, ecritureGeneree: ecritureId != null };
}

/**
 * Paie UN crédit du client en tirant sur le solde du compte courant (CDC §8),
 * dans une transaction fournie : applique le remboursement (échéances + cascade
 * RIA via enregistrerRemboursementCredit), débite le CC (mouvement PAIEMENT_CREDIT
 * + écriture Débit CC 419 / Crédit Ventes 701) et met à jour solde/totaux.
 *
 * Mutualisé entre le paiement manuel (POST /[id]/paiements) et le prélèvement
 * automatique (§19.C). N'effectue PAS l'audit/notif de lot ni l'alerte « solde
 * faible » : c'est à la charge de l'appelant (qui a le contexte global).
 */
export async function payerCreditDepuisCC(
  tx: TxClient,
  opts: {
    compteId: number; numeroCompte: string; codeAgence: string; clientNom: string;
    creditId: number; creditRef: string; montant: number; userId: number;
    param: { compteCourantClientNumero: string; compteVentesNumero: string };
    observation?: string | null; ip?: string | null; userAgent?: string | null;
  },
): Promise<{ montantApplique: number; estSolde: boolean; soldeApres: number | null; mouvement: { id: number; reference: string } | null; ecritureGeneree: boolean }> {
  // 1) Applique le remboursement au crédit (montant capé au solde restant).
  const remb = await enregistrerRemboursementCredit(tx, {
    creditId: opts.creditId,
    montant: opts.montant,
    numeroJour: null,
    observation: `Paiement depuis compte courant ${opts.numeroCompte}${opts.observation ? ` — ${opts.observation}` : ""}`,
    modePaiement: TypePaiement.WALLET_GENERAL,
    enregistreParId: opts.userId,
    agentCollecteurId: opts.userId,
    confirmer: true,
  });
  if (!remb.ok) throw new Error(remb.error);
  const applique = remb.montantEffectif;
  if (applique <= 0) {
    return { montantApplique: 0, estSolde: remb.estSolde, soldeApres: null, mouvement: null, ecritureGeneree: true };
  }

  // 2) Débite le compte courant du montant réellement imputé.
  const courant = await tx.compteCourant.findUnique({ where: { id: opts.compteId }, select: { solde: true } });
  const avant = Number(courant?.solde ?? 0);
  if (applique > avant) throw new Error("Solde du compte courant insuffisant");
  const apres = avant - applique;

  const ecritureId = await creerEcritureCC(tx, {
    journal: "OD",
    date: new Date(),
    libelle: `Paiement crédit ${opts.creditRef} via compte courant ${opts.numeroCompte} — ${opts.clientNom}`,
    userId: opts.userId,
    lignes: [
      { numero: opts.param.compteCourantClientNumero, debit:  applique, libelle: `Utilisation CC ${opts.numeroCompte}` },
      { numero: opts.param.compteVentesNumero,        credit: applique, libelle: `Règlement crédit ${opts.creditRef}` },
    ],
  });

  const reference = await genererReferenceMouvementCC(tx, "PAY");
  const agenceOp = (await resoudreAgenceOperation(tx, opts.userId)) ?? opts.codeAgence;
  const mouvement = await tx.mouvementCompteCourant.create({
    data: {
      reference, compteId: opts.compteId, nature: "PAIEMENT_CREDIT",
      montant: -applique, soldeAvant: avant, soldeApres: apres,
      observation: `Crédit ${opts.creditRef}${opts.observation ? ` · ${opts.observation}` : ""}`,
      statut: "VALIDE", userId: opts.userId, agence: agenceOp, ecritureId, creditId: opts.creditId,
      ip: opts.ip ?? null, userAgent: opts.userAgent ?? null,
    },
    select: { id: true, reference: true },
  });

  await tx.compteCourant.update({
    where: { id: opts.compteId },
    data: {
      solde: apres,
      totalUtilise: { increment: applique },
      nbMouvements: { increment: 1 },
      derniereOperationAt: new Date(),
    },
  });

  return { montantApplique: applique, estSolde: remb.estSolde, soldeApres: apres, mouvement, ecritureGeneree: ecritureId != null };
}
