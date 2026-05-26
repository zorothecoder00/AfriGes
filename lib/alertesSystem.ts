/**
 * Système d'alertes automatiques (Module 9).
 *
 * 5 types d'alertes déclenchées quotidiennement par le cron :
 *   1. Retard crédit > X jours          (ALERT_RETARD_JOURS, défaut: 3)
 *   2. Dépassement plafond crédit        (ALERT_PLAFOND_CREDIT, défaut: 500000)
 *   3. Faible collecte agent             (ALERT_COLLECTE_MIN_PCT, défaut: 20 %)
 *   4. Client inactif                    (ALERT_INACTIVITE_JOURS, défaut: 14)
 *   5. Paiement manqué (échéance passée) (automatique)
 *
 * Canaux : notification in-app + SMS + WhatsApp (si activés).
 * Déduplication : une alerte du même type par entité n'est envoyée qu'une fois par jour.
 */

import { prisma } from "@/lib/prisma";
import { PrioriteNotification } from "@prisma/client";
import { sendSMS } from "@/lib/sms";
import { sendWhatsApp } from "@/lib/whatsapp";

// ─── Seuils configurables ──────────────────────────────────────────────────────

const SEUIL_RETARD_JOURS     = parseInt(process.env.ALERT_RETARD_JOURS     ?? "3");
const SEUIL_INACTIVITE_JOURS = parseInt(process.env.ALERT_INACTIVITE_JOURS ?? "14");
const SEUIL_COLLECTE_MIN_PCT = parseInt(process.env.ALERT_COLLECTE_MIN_PCT ?? "20");
const SEUIL_PLAFOND_CREDIT   = parseFloat(process.env.ALERT_PLAFOND_CREDIT  ?? "500000");
const PERIODE_COLLECTE_JOURS = parseInt(process.env.ALERT_COLLECTE_PERIODE ?? "7");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Vérifie si une notification avec ce titre-clé a déjà été envoyée
 * à cet utilisateur aujourd'hui (déduplication).
 */
async function dejaNotifieAujourdhui(userId: number, titreKey: string): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      titre:     { contains: titreKey },
      createdAt: { gte: todayStart() },
    },
    select: { id: true },
  });
  return !!existing;
}

/**
 * Crée une notification in-app et envoie SMS + WhatsApp si le numéro est fourni.
 */
async function notifierEtEnvoyer(
  userId: number,
  telephone: string | null,
  titre: string,
  message: string,
  priorite: PrioriteNotification,
  actionUrl?: string,
): Promise<void> {
  await prisma.notification.create({
    data: { userId, titre, message, priorite, actionUrl: actionUrl ?? null },
  });

  if (telephone) {
    await Promise.allSettled([
      sendSMS(telephone, `${titre}\n${message}`),
      sendWhatsApp(telephone, `*${titre}*\n${message}`),
    ]);
  }
}

// ─── Récupérer les IDs admin ───────────────────────────────────────────────────

async function getAdminIds(): Promise<number[]> {
  const admins = await prisma.user.findMany({
    where:  { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true },
  });
  return admins.map((u) => u.id);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTE 1 — Crédit en retard depuis plus de X jours
// ═══════════════════════════════════════════════════════════════════════════════

async function alertesRetardCredit(): Promise<number> {
  const seuil = daysAgo(SEUIL_RETARD_JOURS);

  const creditsEnRetard = await prisma.creditClient.findMany({
    where: { statut: "EN_RETARD" },
    select: {
      id: true,
      reference: true,
      soldeRestant: true,
      client: {
        select: {
          id: true,
          nom: true,
          prenom: true,
          telephone: true,
          agentTerrainId: true,
          agentTerrain: { select: { id: true, telephone: true } },
        },
      },
      echeances: {
        where:   { statut: "EN_RETARD" },
        orderBy: { dateEcheance: "asc" },
        take:    1,
        select:  { dateEcheance: true },
      },
    },
  });

  const adminIds = await getAdminIds();
  let count = 0;

  for (const credit of creditsEnRetard) {
    const premiereEcheanceRetard = credit.echeances[0];
    if (!premiereEcheanceRetard) continue;
    if (premiereEcheanceRetard.dateEcheance > seuil) continue; // pas encore assez vieux

    const client   = credit.client;
    const nomClient = `${client.prenom} ${client.nom}`;
    const titreKey  = `Retard crédit ${credit.reference}`;
    const message   =
      `Le crédit ${credit.reference} de ${nomClient} est en retard depuis ` +
      `plus de ${SEUIL_RETARD_JOURS} jours. Solde restant : ` +
      `${Number(credit.soldeRestant).toLocaleString("fr-FR")} FCFA.`;

    // Notifier les admins
    for (const adminId of adminIds) {
      if (await dejaNotifieAujourdhui(adminId, titreKey)) continue;
      await notifierEtEnvoyer(adminId, null, titreKey, message, PrioriteNotification.HAUTE,
        `/dashboard/admin/credits`);
      count++;
    }

    // Notifier l'agent terrain responsable
    if (client.agentTerrain) {
      const agentId = client.agentTerrain.id;
      if (!(await dejaNotifieAujourdhui(agentId, titreKey))) {
        await notifierEtEnvoyer(
          agentId,
          client.agentTerrain.telephone,
          titreKey,
          message,
          PrioriteNotification.HAUTE,
          `/dashboard/user/agentsTerrain`,
        );
        count++;
      }
    }
  }

  return count;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTE 2 — Dépassement plafond crédit
// ═══════════════════════════════════════════════════════════════════════════════

async function alertesDepassementPlafond(): Promise<number> {
  const creditsAuDessus = await prisma.creditClient.findMany({
    where: {
      statut:       { in: ["ACTIF", "EN_RETARD"] },
      montantTotal: { gt: SEUIL_PLAFOND_CREDIT },
    },
    select: {
      id:           true,
      reference:    true,
      montantTotal: true,
      client: { select: { id: true, nom: true, prenom: true } },
    },
  });

  const adminIds = await getAdminIds();
  let count = 0;

  for (const credit of creditsAuDessus) {
    const titreKey = `Plafond dépassé ${credit.reference}`;
    const message  =
      `Le crédit ${credit.reference} de ${credit.client.prenom} ${credit.client.nom} ` +
      `dépasse le plafond autorisé : ` +
      `${Number(credit.montantTotal).toLocaleString("fr-FR")} FCFA ` +
      `(plafond : ${SEUIL_PLAFOND_CREDIT.toLocaleString("fr-FR")} FCFA).`;

    for (const adminId of adminIds) {
      if (await dejaNotifieAujourdhui(adminId, titreKey)) continue;
      await notifierEtEnvoyer(adminId, null, titreKey, message, PrioriteNotification.HAUTE,
        `/dashboard/admin/credits`);
      count++;
    }
  }

  return count;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTE 3 — Faible collecte agent terrain
// ═══════════════════════════════════════════════════════════════════════════════

async function alertesFaibleCollecte(): Promise<number> {
  const depuis = daysAgo(PERIODE_COLLECTE_JOURS);

  // Agents terrain actifs
  const agents = await prisma.gestionnaire.findMany({
    where:  { role: "AGENT_TERRAIN", actif: true },
    select: { memberId: true, member: { select: { id: true, nom: true, prenom: true, telephone: true } } },
  });

  if (agents.length === 0) return 0;
  const agentIds = agents.map((a) => a.memberId);

  // Montants collectés par agent sur la période (3 sources)
  const [versements, remboursements, ventes] = await Promise.all([
    prisma.versementPack.groupBy({
      by:    ["encaisseParId"],
      where: { encaisseParId: { in: agentIds }, datePaiement: { gte: depuis }, statut: "PAYE" },
      _sum:  { montant: true },
    }),
    prisma.remboursementCredit.groupBy({
      by:    ["enregistreParId"],
      where: { enregistreParId: { in: agentIds }, dateRemboursement: { gte: depuis } },
      _sum:  { montant: true },
    }),
    prisma.venteDirecte.groupBy({
      by:    ["vendeurId"],
      where: { vendeurId: { in: agentIds }, createdAt: { gte: depuis }, statut: { notIn: ["ANNULEE", "BROUILLON"] } },
      _sum:  { montantTotal: true },
    }),
  ]);

  const collecteMap = new Map<number, number>();
  for (const v of versements)     if (v.encaisseParId   !== null) collecteMap.set(v.encaisseParId,   (collecteMap.get(v.encaisseParId)   ?? 0) + Number(v._sum.montant      ?? 0));
  for (const r of remboursements) if (r.enregistreParId !== null) collecteMap.set(r.enregistreParId, (collecteMap.get(r.enregistreParId) ?? 0) + Number(r._sum.montant      ?? 0));
  for (const vd of ventes)        if (vd.vendeurId      !== null) collecteMap.set(vd.vendeurId,      (collecteMap.get(vd.vendeurId)      ?? 0) + Number(vd._sum.montantTotal ?? 0));

  // Montant prévu total par agent sur la période (somme des échéances planifiées)
  const echeancesPrevues = await prisma.echeancePack.groupBy({
    by:    ["souscriptionId"],
    where: { datePrevue: { gte: depuis } },
    _sum:  { montant: true },
  });
  // On récupère aussi les souscriptions pour relier au client/agent
  const souscriptions = await prisma.souscriptionPack.findMany({
    where:  { client: { agentTerrainId: { in: agentIds } } },
    select: { id: true, client: { select: { agentTerrainId: true } } },
  });
  const souscMap = Object.fromEntries(souscriptions.map((s) => [s.id, s.client?.agentTerrainId]));

  const prevuMap = new Map<number, number>();
  for (const ep of echeancesPrevues) {
    const agentId = souscMap[ep.souscriptionId];
    if (!agentId) continue;
    prevuMap.set(agentId, (prevuMap.get(agentId) ?? 0) + Number(ep._sum.montant ?? 0));
  }

  const adminIds = await getAdminIds();
  let count = 0;

  for (const agent of agents) {
    const agentId   = agent.memberId;
    const prevu     = prevuMap.get(agentId) ?? 0;
    if (prevu === 0) continue; // pas d'échéances prévues → pas d'alerte

    const collecte  = collecteMap.get(agentId) ?? 0;
    const pct       = Math.round((collecte / prevu) * 100);
    if (pct >= SEUIL_COLLECTE_MIN_PCT) continue;

    const nomAgent  = `${agent.member.prenom} ${agent.member.nom}`;
    const titreKey  = `Faible collecte ${agentId}`;
    const message   =
      `L'agent ${nomAgent} n'a collecté que ${pct}% du montant prévu ` +
      `sur les ${PERIODE_COLLECTE_JOURS} derniers jours ` +
      `(${collecte.toLocaleString("fr-FR")} / ${prevu.toLocaleString("fr-FR")} FCFA).`;

    // Notifier admins
    for (const adminId of adminIds) {
      if (await dejaNotifieAujourdhui(adminId, titreKey)) continue;
      await notifierEtEnvoyer(adminId, null, titreKey, message, PrioriteNotification.NORMAL,
        `/dashboard/admin/collectes`);
      count++;
    }

    // Notifier l'agent lui-même
    if (!(await dejaNotifieAujourdhui(agentId, titreKey))) {
      await notifierEtEnvoyer(agentId, agent.member.telephone, titreKey, message,
        PrioriteNotification.NORMAL, `/dashboard/user/agentsTerrain`);
      count++;
    }
  }

  return count;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTE 4 — Client inactif (aucun versement/remboursement depuis X jours)
// ═══════════════════════════════════════════════════════════════════════════════

async function alertesClientsInactifs(): Promise<number> {
  const depuis = daysAgo(SEUIL_INACTIVITE_JOURS);

  // Clients avec crédit ou souscription active
  const clientsActifs = await prisma.client.findMany({
    where: {
      OR: [
        { creditsClients:     { some: { statut: { in: ["ACTIF", "EN_RETARD"] } } } },
        { souscriptionsPacks: { some: { statut: { in: ["ACTIF", "EN_ATTENTE"] } } } },
      ],
    },
    select: {
      id:            true,
      nom:           true,
      prenom:        true,
      telephone:     true,
      agentTerrainId: true,
      agentTerrain:  { select: { id: true, telephone: true } },
      souscriptionsPacks: {
        where:  { statut: { in: ["ACTIF", "EN_ATTENTE"] } },
        select: {
          versements: {
            orderBy: { datePaiement: "desc" },
            take:    1,
            select:  { datePaiement: true },
          },
        },
        take: 1,
      },
      creditsClients: {
        where:  { statut: { in: ["ACTIF", "EN_RETARD"] } },
        select: {
          remboursements: {
            orderBy: { dateRemboursement: "desc" },
            take:    1,
            select:  { dateRemboursement: true },
          },
        },
        take: 1,
      },
    },
  });

  const adminIds = await getAdminIds();
  let count = 0;

  for (const client of clientsActifs) {
    // Dernier mouvement financier du client
    const dernierVersement    = client.souscriptionsPacks[0]?.versements[0]?.datePaiement;
    const dernierRemboursement = client.creditsClients[0]?.remboursements[0]?.dateRemboursement;

    const dernierMouvement = [dernierVersement, dernierRemboursement]
      .filter(Boolean)
      .sort((a, b) => b!.getTime() - a!.getTime())[0];

    // Si aucun mouvement du tout, ou dernier mouvement trop ancien
    if (dernierMouvement && dernierMouvement > depuis) continue;

    const nomClient = `${client.prenom} ${client.nom}`;
    const titreKey  = `Client inactif ${client.id}`;
    const nbJours   = dernierMouvement
      ? Math.floor((Date.now() - dernierMouvement.getTime()) / 86_400_000)
      : SEUIL_INACTIVITE_JOURS;
    const message   =
      `Le client ${nomClient} est inactif depuis ${nbJours} jours ` +
      `(aucun versement ni remboursement enregistré).`;

    // Notifier admins
    for (const adminId of adminIds) {
      if (await dejaNotifieAujourdhui(adminId, titreKey)) continue;
      await notifierEtEnvoyer(adminId, null, titreKey, message, PrioriteNotification.NORMAL,
        `/dashboard/admin/clients`);
      count++;
    }

    // Notifier l'agent terrain responsable
    if (client.agentTerrain) {
      const agentId = client.agentTerrain.id;
      if (!(await dejaNotifieAujourdhui(agentId, titreKey))) {
        await notifierEtEnvoyer(agentId, client.agentTerrain.telephone, titreKey, message,
          PrioriteNotification.NORMAL, `/dashboard/user/agentsTerrain`);
        count++;
      }
    }

    // SMS/WA au client lui-même
    if (client.telephone) {
      await Promise.allSettled([
        sendSMS(client.telephone,
          `Bonjour ${nomClient}, votre compte AfriGes est inactif depuis ${nbJours} jours. Contactez votre agent pour régulariser votre situation.`),
        sendWhatsApp(client.telephone,
          `Bonjour *${nomClient}*, votre compte AfriGes est inactif depuis *${nbJours} jours*. Contactez votre agent pour régulariser votre situation.`),
      ]);
    }
  }

  return count;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTE 5 — Paiement manqué (échéance EN_RETARD non encore alertée)
// ═══════════════════════════════════════════════════════════════════════════════

async function alertesPaiementsManques(): Promise<number> {
  const hier = daysAgo(1);

  // Échéances crédit passées non payées
  const echeancesRetard = await prisma.echeanceCredit.findMany({
    where: {
      statut:      "EN_RETARD",
      dateEcheance: { lte: hier },
    },
    select: {
      id:          true,
      dateEcheance: true,
      montantDu:   true,
      credit: {
        select: {
          id:        true,
          reference: true,
          client: {
            select: {
              id:            true,
              nom:           true,
              prenom:        true,
              telephone:     true,
              agentTerrainId: true,
              agentTerrain:  { select: { id: true, telephone: true } },
            },
          },
        },
      },
    },
  });

  const adminIds = await getAdminIds();
  let count = 0;

  for (const echeance of echeancesRetard) {
    const client    = echeance.credit.client;
    const nomClient = `${client.prenom} ${client.nom}`;
    const dateStr   = echeance.dateEcheance.toLocaleDateString("fr-FR");
    const titreKey  = `Paiement manqué ${echeance.credit.reference} ${dateStr}`;
    const message   =
      `Paiement manqué pour le crédit ${echeance.credit.reference} de ${nomClient}. ` +
      `Échéance du ${dateStr} : ${Number(echeance.montantDu).toLocaleString("fr-FR")} FCFA non réglée.`;

    // Notifier admins
    for (const adminId of adminIds) {
      if (await dejaNotifieAujourdhui(adminId, titreKey)) continue;
      await notifierEtEnvoyer(adminId, null, titreKey, message, PrioriteNotification.HAUTE,
        `/dashboard/admin/credits`);
      count++;
    }

    // Notifier l'agent terrain
    if (client.agentTerrain) {
      const agentId = client.agentTerrain.id;
      if (!(await dejaNotifieAujourdhui(agentId, titreKey))) {
        await notifierEtEnvoyer(agentId, client.agentTerrain.telephone, titreKey, message,
          PrioriteNotification.HAUTE, `/dashboard/user/agentsTerrain`);
        count++;
      }
    }

    // SMS/WA au client
    if (client.telephone) {
      await Promise.allSettled([
        sendSMS(client.telephone,
          `Bonjour ${nomClient}, votre échéance du ${dateStr} (${Number(echeance.montantDu).toLocaleString("fr-FR")} FCFA) n'a pas été reçue. Merci de régulariser rapidement.`),
        sendWhatsApp(client.telephone,
          `Bonjour *${nomClient}*, votre échéance du *${dateStr}* (*${Number(echeance.montantDu).toLocaleString("fr-FR")} FCFA*) n'a pas été reçue. Merci de régulariser rapidement.`),
      ]);
    }
  }

  return count;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export interface ResultatAlertes {
  retardCredit:      number;
  depassementPlafond: number;
  faibleCollecte:    number;
  clientsInactifs:   number;
  paiementsManques:  number;
  total:             number;
}

/**
 * Déclenche l'ensemble des vérifications d'alertes.
 * Appelée par le cron quotidien ou manuellement.
 */
export async function runAlertes(): Promise<ResultatAlertes> {
  const [retardCredit, depassementPlafond, faibleCollecte, clientsInactifs, paiementsManques] =
    await Promise.allSettled([
      alertesRetardCredit(),
      alertesDepassementPlafond(),
      alertesFaibleCollecte(),
      alertesClientsInactifs(),
      alertesPaiementsManques(),
    ]).then((results) =>
      results.map((r) => (r.status === "fulfilled" ? r.value : 0))
    );

  return {
    retardCredit,
    depassementPlafond,
    faibleCollecte,
    clientsInactifs,
    paiementsManques,
    total: retardCredit + depassementPlafond + faibleCollecte + clientsInactifs + paiementsManques,
  };
}
