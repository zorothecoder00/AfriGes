// lib/popc/alertesServer.ts
// §12 — Alertes automatiques. Évalue les 5 conditions de risque du CDC à partir
// des objectifs (ObjectifPOPC) et des réalisations réelles. Serveur uniquement.

import { prisma } from "@/lib/prisma";
import { PrioriteNotification } from "@prisma/client";
import { calculerConsolidationDirection, calculerTableauCommercial } from "@/lib/popc/realisationsServer";
import { notifyRoles, notify, auditLog } from "@/lib/notifications";

export type SeveriteAlerte = "URGENT" | "HAUTE" | "NORMAL";

export interface AlertePOPC {
  code: string;
  severite: SeveriteAlerte;
  categorie: string;
  titre: string;
  message: string;
  cible?: { type: "commercial" | "agence"; id: number; nom: string };
}

// Seuil de performance en-dessous duquel un commercial est signalé (% de son objectif).
const SEUIL_PERF_COMMERCIAL = 50;
// On ne juge la sous-performance qu'après ce % du mois écoulé (évite les faux positifs en début de mois).
const FRACTION_MIN_JUGEMENT = 0.3;

/** Fraction du mois écoulée (0 si futur, 1 si passé). */
function fractionMoisEcoulee(annee: number, mois: number): number {
  const now = new Date();
  const debut = new Date(Date.UTC(annee, mois - 1, 1));
  const fin = new Date(Date.UTC(annee, mois, 1));
  if (now >= fin) return 1;
  if (now < debut) return 0;
  return (now.getTime() - debut.getTime()) / (fin.getTime() - debut.getTime());
}

const fmt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));

/**
 * Évalue les alertes POPC d'un mois (portée globale, pdv=0).
 * Retourne une liste triée par sévérité (URGENT → NORMAL).
 */
export async function evaluerAlertesPOPC(annee: number, mois: number): Promise<AlertePOPC[]> {
  const param = await prisma.parametragePOPC.findUnique({
    where: { annee_mois_pointDeVenteId: { annee, mois, pointDeVenteId: 0 } },
    include: { objectif: true },
  });
  // Sans objectifs générés, aucune référence pour juger → pas d'alerte.
  if (!param?.objectif) return [];

  const o = param.objectif;
  const g = await calculerConsolidationDirection(annee, mois, 0);
  const fraction = fractionMoisEcoulee(annee, mois);
  const alertes: AlertePOPC[] = [];

  // 1) Nombre de nouveaux crédits insuffisant (rythme sous l'objectif proraté).
  const attenduCredits = o.nbNouveauxCredits * fraction;
  if (o.nbNouveauxCredits > 0 && g.nouveauxCredits < attenduCredits * 0.9) {
    const retard = Math.max(0, Math.ceil(attenduCredits - g.nouveauxCredits));
    alertes.push({
      code: "CREDITS_INSUFFISANTS",
      severite: g.nouveauxCredits < attenduCredits * 0.6 ? "URGENT" : "HAUTE",
      categorie: "Livraisons",
      titre: "Nouveaux crédits insuffisants",
      message: `${g.nouveauxCredits} crédit(s) livré(s) sur ${Math.ceil(attenduCredits)} attendu(s) à ce stade du mois (objectif ${o.nbNouveauxCredits}). Retard estimé : ${retard}.`,
    });
  }

  // 2) Nombre de 16èmes prévus inférieur au seuil nécessaire (structurel).
  if (o.nbSeiziemes > 0 && g.seiziemesAttendus < o.nbSeiziemes) {
    alertes.push({
      code: "SEIZIEMES_INSUFFISANTS",
      severite: g.seiziemesAttendus < o.nbSeiziemes * 0.7 ? "HAUTE" : "NORMAL",
      categorie: "Collectes",
      titre: "16èmes prévus insuffisants",
      message: `${g.seiziemesAttendus} 16ème(s) programmé(s) ce mois pour un objectif de ${o.nbSeiziemes}. Le portefeuille Quinzaine ne suffira pas à générer le revenu attendu.`,
    });
  }

  // 3) Charges du mois risquant de ne pas être couvertes (déficit prévisionnel).
  if (g.chargesTotales > 0 && g.revenusAttendus < g.chargesTotales) {
    const manque = g.chargesTotales - g.revenusAttendus;
    alertes.push({
      code: "CHARGES_NON_COUVERTES",
      severite: "URGENT",
      categorie: "Rentabilité",
      titre: "Charges à risque de non-couverture",
      message: `Revenus attendus ${fmt(g.revenusAttendus)} FCFA < charges ${fmt(g.chargesTotales)} FCFA. Déficit prévisionnel de ${fmt(manque)} FCFA.`,
    });
  }

  // 4) Performance d'un commercial inférieure à l'objectif.
  if (fraction >= FRACTION_MIN_JUGEMENT) {
    const agents = await prisma.user.findMany({
      where: { gestionnaire: { role: "AGENT_TERRAIN", actif: true } },
      select: { id: true, nom: true, prenom: true },
    });
    for (const a of agents) {
      const t = await calculerTableauCommercial(a.id, annee, mois);
      // On ne signale que les agents ayant un portefeuille (sinon bruit).
      if (t.clientsAffectes === 0) continue;
      if (t.objectifAgent > 0 && t.tauxRealisation < SEUIL_PERF_COMMERCIAL) {
        alertes.push({
          code: "PERF_COMMERCIAL",
          severite: t.tauxRealisation < SEUIL_PERF_COMMERCIAL / 2 ? "HAUTE" : "NORMAL",
          categorie: "Performance",
          titre: `Performance faible — ${a.prenom} ${a.nom}`,
          message: `Taux de réalisation ${t.tauxRealisation}% (${fmt(t.montantCollecte)} / ${fmt(t.objectifAgent)} FCFA). ${t.clientsRestants} client(s) restant à visiter.`,
          cible: { type: "commercial", id: a.id, nom: `${a.prenom} ${a.nom}` },
        });
      }
    }
  }

  // 5) Agence présentant un risque de déficit.
  const nbAgences = param.nombreAgences > 0 ? param.nombreAgences : 1;
  const chargeParAgenceGlobale = g.chargesTotales / nbAgences;
  const pdvs = await prisma.pointDeVente.findMany({ select: { id: true, nom: true } });
  for (const p of pdvs) {
    const c = await calculerConsolidationDirection(annee, mois, p.id);
    // Charge de référence : celle propre à l'agence si paramétrée, sinon la quote-part globale.
    const chargeRef = c.chargesTotales > 0 ? c.chargesTotales : chargeParAgenceGlobale;
    if (chargeRef <= 0) continue;
    if (c.revenusAttendus < chargeRef) {
      const manque = chargeRef - c.revenusAttendus;
      alertes.push({
        code: "AGENCE_DEFICIT",
        severite: c.revenusAttendus < chargeRef * 0.6 ? "HAUTE" : "NORMAL",
        categorie: "Agence",
        titre: `Risque de déficit — ${p.nom}`,
        message: `Revenus attendus ${fmt(c.revenusAttendus)} FCFA < charge de référence ${fmt(chargeRef)} FCFA (manque ${fmt(manque)} FCFA).`,
        cible: { type: "agence", id: p.id, nom: p.nom },
      });
    }
  }

  const ordre: Record<SeveriteAlerte, number> = { URGENT: 0, HAUTE: 1, NORMAL: 2 };
  return alertes.sort((a, b) => ordre[a.severite] - ordre[b.severite]);
}

const PRIORITE: Record<SeveriteAlerte, PrioriteNotification> = {
  URGENT: PrioriteNotification.URGENT,
  HAUTE: PrioriteNotification.HAUTE,
  NORMAL: PrioriteNotification.NORMAL,
};

// Destinataires « pilotage » (les admins sont ajoutés automatiquement par notifyRoles).
const ROLES_PILOTAGE = ["RESPONSABLE_ECONOMIQUE", "COMPTABLE", "CHEF_AGENCE", "CONTROLEUR_TERRAIN"];

/**
 * Évalue puis diffuse les alertes du mois par notification (CDC §12).
 * Utilisé par la route manuelle (auteurId = utilisateur) et le cron (auteurId null).
 */
export async function diffuserAlertesPOPC(
  annee: number, mois: number, auteurId?: number | null,
): Promise<{ envoyees: number }> {
  const alertes = await evaluerAlertesPOPC(annee, mois);
  if (alertes.length === 0) return { envoyees: 0 };

  await prisma.$transaction(async (tx) => {
    for (const a of alertes) {
      const payload = {
        titre: `Alerte POPC — ${a.titre}`,
        message: a.message,
        priorite: PRIORITE[a.severite],
        actionUrl: "/dashboard/admin/popc/alertes",
      };
      await notifyRoles(tx, ROLES_PILOTAGE, payload);
      // Alerte ciblant un commercial : l'informer directement.
      if (a.cible?.type === "commercial") {
        await notify(tx, [a.cible.id], payload);
      }
    }
    if (auteurId) {
      await auditLog(tx, auteurId, "POPC_ALERTES_DIFFUSEES", "ParametragePOPC", undefined, {
        annee, mois, total: alertes.length,
      });
    }
  });

  return { envoyees: alertes.length };
}
