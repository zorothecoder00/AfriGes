// lib/automatisationMarketing.ts
//
// Moteur d'automatisation marketing (CDC §16-20) : détecte les clients
// franchissant un déclencheur (§18) et fait progresser leurs séquences
// d'étapes à délai (§16-17), en exécutant les actions (§19) via les briques
// existantes (envoi de message, fidélité, tags, affectation commercial).
//
// S'inspire de la mécanique à paliers de `lib/riaRecouvrement.ts` (mémoriser
// le dernier palier franchi pour rester idempotent) mais la simplifie : le
// délai de chaque étape est relatif à l'exécution réelle de l'étape
// précédente (pas à une date d'échéance fixe), donc pas besoin de rattraper
// plusieurs paliers en un seul passage cron.
//
// Les actions exécutées sont attribuées au créateur de la règle
// (`regle.creeParId`) — c'est cette personne qui a défini le comportement
// automatisé, il n'existe pas d'"utilisateur système" dans ce codebase.

import { prisma } from "@/lib/prisma";
import { PrioriteNotification } from "@prisma/client";
import { notify, notifyRoles } from "@/lib/notifications";
import { resoudreVariables } from "@/lib/personnalisationMessage";
import { envoyerMessageAUnClient } from "@/lib/envoiCampagne";
import { ajouterTagClient, retirerTagClient } from "@/lib/clientTags";
import { attribuerPointsFidelite } from "@/lib/fidelite";

const JOUR_MS = 24 * 60 * 60 * 1000;
const VENTES_EXCLUES = ["ANNULEE", "BROUILLON"];
/** Fenêtre de détection glissante — couvre un éventuel retard/oubli du cron. */
const FENETRE_DETECTION_MS = 2 * JOUR_MS;

// ─── Détection des nouveaux candidats par déclencheur ──────────────────────

async function detecterCandidats(
  declencheur: string,
  params: Record<string, unknown>,
): Promise<number[]> {
  const depuisFenetre = new Date(Date.now() - FENETRE_DETECTION_MS);

  switch (declencheur) {
    case "NOUVEAU_CLIENT": {
      const clients = await prisma.client.findMany({
        where: { createdAt: { gte: depuisFenetre } },
        select: { id: true },
      });
      return clients.map((c) => c.id);
    }

    case "PREMIER_ACHAT": {
      const ventesRecentes = await prisma.venteDirecte.findMany({
        where: { createdAt: { gte: depuisFenetre }, statut: { notIn: VENTES_EXCLUES as never }, clientId: { not: null } },
        select: { clientId: true },
      });
      const candidats = [...new Set(ventesRecentes.map((v) => v.clientId).filter((id): id is number => id != null))];
      if (!candidats.length) return [];
      const counts = await prisma.venteDirecte.groupBy({
        by: ["clientId"],
        where: { clientId: { in: candidats }, statut: { notIn: VENTES_EXCLUES as never } },
        _count: { _all: true },
      });
      return counts.filter((c) => c._count._all === 1).map((c) => c.clientId as number);
    }

    case "ACHAT_PRODUIT": {
      const produitId = Number(params.produitId);
      if (!produitId) return [];
      const lignes = await prisma.ligneVenteDirecte.findMany({
        where: {
          produitId,
          vente: { createdAt: { gte: depuisFenetre }, statut: { notIn: VENTES_EXCLUES as never }, clientId: { not: null } },
        },
        select: { vente: { select: { clientId: true } } },
      });
      return [...new Set(lignes.map((l) => l.vente.clientId).filter((id): id is number => id != null))];
    }

    case "PANIER_ELEVE": {
      const montantMin = Number(params.montantMin ?? 0);
      const ventes = await prisma.venteDirecte.findMany({
        where: { createdAt: { gte: depuisFenetre }, statut: { notIn: VENTES_EXCLUES as never }, montantTotal: { gte: montantMin }, clientId: { not: null } },
        select: { clientId: true },
      });
      return [...new Set(ventes.map((v) => v.clientId).filter((id): id is number => id != null))];
    }

    case "CLIENT_INACTIF": {
      const seuilJours = Number(params.seuilJours ?? 30);
      const seuilDate = new Date(Date.now() - seuilJours * JOUR_MS);
      const dernieresVentes = await prisma.venteDirecte.groupBy({
        by: ["clientId"],
        where: { clientId: { not: null }, statut: { notIn: VENTES_EXCLUES as never } },
        _max: { createdAt: true },
      });
      return dernieresVentes
        .filter((d) => d.clientId != null && d._max.createdAt != null && d._max.createdAt < seuilDate)
        .map((d) => d.clientId as number);
    }

    case "ANNIVERSAIRE": {
      const today = new Date();
      const clients = await prisma.client.findMany({
        where: { dateNaissance: { not: null } },
        select: { id: true, dateNaissance: true },
      });
      return clients
        .filter((c) => {
          const d = c.dateNaissance as Date;
          return d.getUTCMonth() === today.getUTCMonth() && d.getUTCDate() === today.getUTCDate();
        })
        .map((c) => c.id);
    }

    default:
      return [];
  }
}

export interface ResultatDetection {
  reglesEvaluees: number;
  nouvellesInscriptions: number;
}

/** Inscrit les nouveaux clients candidats dans une `ExecutionAutomatisation` (idempotent). */
export async function detecterNouveauxCandidats(): Promise<ResultatDetection> {
  const regles = await prisma.regleAutomatisation.findMany({
    where: { actif: true },
    include: { etapes: { orderBy: { ordre: "asc" }, take: 1 } },
  });

  const res: ResultatDetection = { reglesEvaluees: regles.length, nouvellesInscriptions: 0 };

  for (const regle of regles) {
    const premiereEtape = regle.etapes[0];
    if (!premiereEtape) continue; // règle sans étape — rien à exécuter

    const candidats = await detecterCandidats(regle.declencheur, (regle.declencheurParams ?? {}) as Record<string, unknown>);
    if (!candidats.length) continue;

    const dateProchaineFenetre = new Date(Date.now() + premiereEtape.delaiJours * JOUR_MS);
    const { count } = await prisma.executionAutomatisation.createMany({
      data: candidats.map((clientId) => ({
        regleId: regle.id,
        clientId,
        etapeCouranteOrdre: premiereEtape.ordre,
        dateProchaineFenetre,
      })),
      skipDuplicates: true, // @@unique([regleId, clientId]) — un client ne s'engage qu'une fois par règle
    });
    res.nouvellesInscriptions += count;
  }

  return res;
}

// ─── Exécution des étapes dues ──────────────────────────────────────────────

async function executerAction(
  action: string,
  params: Record<string, unknown>,
  clientId: number,
  executionId: number,
  actorUserId: number,
): Promise<string> {
  switch (action) {
    case "ENVOYER_SMS":
    case "ENVOYER_EMAIL":
    case "ENVOYER_WHATSAPP": {
      const canalId = Number(params.canalId);
      const modeleMessageId = Number(params.modeleMessageId);
      if (!canalId || !modeleMessageId) throw new Error("Paramètres d'envoi manquants (canalId/modeleMessageId)");
      const issue = await envoyerMessageAUnClient({ clientId, canalId, modeleMessageId, campagneId: null, userId: actorUserId });
      if (issue.statut === "ENVOYE") return "Message envoyé";
      if (issue.statut === "BLOQUE_CONSENTEMENT") throw new Error("Bloqué : client sans consentement pour ce canal");
      if (issue.statut === "BLOQUE_FREQUENCE") throw new Error("Bloqué : plafond hebdomadaire de communications atteint");
      throw new Error(`Échec d'envoi : ${issue.motif}`);
    }

    case "NOTIFICATION_INTERNE": {
      const [titre, message] = await Promise.all([
        resoudreVariables(String(params.titre ?? "Automatisation marketing"), clientId),
        resoudreVariables(String(params.message ?? ""), clientId),
      ]);
      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { agentTerrainId: true } });
      await prisma.$transaction(async (tx) => {
        if (client?.agentTerrainId) {
          await notify(tx, [client.agentTerrainId], { titre, message, priorite: PrioriteNotification.NORMAL });
        }
        await notifyRoles(tx, ["RESPONSABLE_MARKETING"], { titre, message, priorite: PrioriteNotification.NORMAL });
      });
      return "Notification envoyée";
    }

    case "ATTRIBUER_COMMERCIAL": {
      const agentId = Number(params.agentId);
      if (!agentId) throw new Error("Paramètre agentId manquant");
      await prisma.$transaction(async (tx) => {
        await tx.clientAgentAffectation.updateMany({ where: { clientId, actif: true }, data: { actif: false, dateFin: new Date() } });
        await tx.clientAgentAffectation.create({ data: { clientId, agentId, notes: "Attribué automatiquement (automatisation marketing)" } });
        await tx.client.update({ where: { id: clientId }, data: { agentTerrainId: agentId } });
      });
      return "Commercial attribué";
    }

    case "CREER_TACHE": {
      const assigneAId = Number(params.assigneAId);
      if (!assigneAId) throw new Error("Paramètre assigneAId manquant");
      const [titre, description] = await Promise.all([
        resoudreVariables(String(params.titre ?? "Tâche marketing"), clientId),
        params.description ? resoudreVariables(String(params.description), clientId) : Promise.resolve(null),
      ]);
      const delaiJoursEcheance = Number(params.delaiJoursEcheance ?? 0);
      await prisma.tacheMarketing.create({
        data: {
          titre, description, clientId, assigneAId, executionId, creeParId: actorUserId,
          dateEcheance: delaiJoursEcheance > 0 ? new Date(Date.now() + delaiJoursEcheance * JOUR_MS) : null,
        },
      });
      return "Tâche créée";
    }

    case "AJOUTER_TAG": {
      const tagId = Number(params.tagId);
      if (!tagId) throw new Error("Paramètre tagId manquant");
      await ajouterTagClient(clientId, tagId);
      return "Tag ajouté";
    }

    case "RETIRER_TAG": {
      const tagId = Number(params.tagId);
      if (!tagId) throw new Error("Paramètre tagId manquant");
      await retirerTagClient(clientId, tagId);
      return "Tag retiré";
    }

    case "ATTRIBUER_POINTS": {
      const points = Number(params.points);
      if (!points) throw new Error("Paramètre points manquant");
      const motif = String(params.motif ?? "Automatisation marketing");
      await prisma.$transaction((tx) =>
        attribuerPointsFidelite(tx, { clientId, points, type: "BONUS", motif, source: "AUTOMATISATION", creeParId: actorUserId })
      );
      return `${points} point(s) attribué(s)`;
    }

    case "DECLENCHER_CAMPAGNE": {
      const campagneId = Number(params.campagneId);
      if (!campagneId) throw new Error("Paramètre campagneId manquant");
      const campagne = await prisma.campagne.findUnique({
        where: { id: campagneId },
        select: { audienceId: true, audience: { select: { type: true } } },
      });
      if (!campagne?.audienceId) throw new Error("Cette campagne n'a pas d'audience associée");
      if (campagne.audience?.type !== "STATIQUE") {
        throw new Error("L'audience de cette campagne n'est pas statique — ajout automatique non supporté");
      }
      await prisma.audienceMarketingMembre.upsert({
        where: { audienceId_clientId: { audienceId: campagne.audienceId, clientId } },
        update: {},
        create: { audienceId: campagne.audienceId, clientId },
      });
      return "Client ajouté à l'audience de la campagne";
    }

    default:
      throw new Error(`Action inconnue : ${action}`);
  }
}

export interface ResultatTraitement {
  traitees: number;
  succes: number;
  echecs: number;
  arretees: number;
  terminees: number;
}

/** Fait progresser toutes les `ExecutionAutomatisation` dont la fenêtre est atteinte. */
export async function traiterExecutionsDues(): Promise<ResultatTraitement> {
  const dues = await prisma.executionAutomatisation.findMany({
    where: { statut: "EN_COURS", dateProchaineFenetre: { lte: new Date() } },
    include: { regle: { include: { etapes: { orderBy: { ordre: "asc" } } } } },
  });

  const res: ResultatTraitement = { traitees: 0, succes: 0, echecs: 0, arretees: 0, terminees: 0 };

  for (const exec of dues) {
    const etape = exec.regle.etapes.find((e) => e.ordre === exec.etapeCouranteOrdre);
    if (!etape) {
      await prisma.executionAutomatisation.update({ where: { id: exec.id }, data: { statut: "TERMINEE", dateFin: new Date() } });
      res.terminees += 1;
      continue;
    }
    res.traitees += 1;

    if (etape.arreterSiAchatEntreTemps) {
      const achat = await prisma.venteDirecte.findFirst({
        where: { clientId: exec.clientId, createdAt: { gte: exec.dateInscription }, statut: { notIn: VENTES_EXCLUES as never } },
        select: { id: true },
      });
      if (achat) {
        await prisma.$transaction(async (tx) => {
          await tx.logAutomatisation.create({
            data: { executionId: exec.id, etapeId: etape.id, statut: "ARRETEE", detail: "Achat détecté depuis l'inscription — séquence arrêtée." },
          });
          await tx.executionAutomatisation.update({ where: { id: exec.id }, data: { statut: "ARRETEE", dateFin: new Date() } });
        });
        res.arretees += 1;
        continue;
      }
    }

    let statutLog: "SUCCES" | "ECHEC" = "SUCCES";
    let detail: string;
    try {
      detail = await executerAction(etape.action, (etape.actionParams ?? {}) as Record<string, unknown>, exec.clientId, exec.id, exec.regle.creeParId);
    } catch (e) {
      statutLog = "ECHEC";
      detail = e instanceof Error ? e.message : "Erreur inconnue";
    }

    const etapeSuivante = exec.regle.etapes.find((e) => e.ordre === exec.etapeCouranteOrdre + 1);
    await prisma.$transaction(async (tx) => {
      await tx.logAutomatisation.create({ data: { executionId: exec.id, etapeId: etape.id, statut: statutLog, detail } });
      if (etapeSuivante) {
        await tx.executionAutomatisation.update({
          where: { id: exec.id },
          data: { etapeCouranteOrdre: etapeSuivante.ordre, dateProchaineFenetre: new Date(Date.now() + etapeSuivante.delaiJours * JOUR_MS) },
        });
      } else {
        await tx.executionAutomatisation.update({ where: { id: exec.id }, data: { statut: "TERMINEE", dateFin: new Date() } });
      }
    });

    if (statutLog === "SUCCES") res.succes += 1; else res.echecs += 1;
    if (!etapeSuivante) res.terminees += 1;
  }

  return res;
}

export interface ResultatAutomatisation extends ResultatDetection, ResultatTraitement {}

/** Orchestrateur appelé par le cron : détection des nouveaux candidats puis traitement des étapes dues. */
export async function executerAutomatisations(): Promise<ResultatAutomatisation> {
  const detection = await detecterNouveauxCandidats();
  const traitement = await traiterExecutionsDues();
  return { ...detection, ...traitement };
}
