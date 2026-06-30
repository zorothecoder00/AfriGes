/**
 * lib/riaRecouvrement.ts
 *
 * Scénario de défaillance client RIA — escalade automatique des retards.
 *
 * Un « retard » n'est pas une donnée externe : il se CALCULE
 *   joursRetard = aujourd'hui − dateEcheance
 * Aucune API payante n'est requise. Le scan est déclenché par le cron Vercel
 * (GET /api/cron/ria/retards) et/ou à la lecture de la page recouvrement.
 *
 * Échelle d'escalade (seuils en jours, paramétrables via ConfigAlerteRIA) :
 *   N1 — Relance automatique   → agent (notif in-app seule)
 *   N2 — Alerte agent          → client.agentTerrainId
 *   N3 — Alerte chef d'agence  → pointDeVente.chefAgenceId
 *   N4 — Alerte RVP            → pointDeVente.rpvId   (remplace « responsable régional »)
 *   N5 — Alerte Direction Gén. → ADMIN / SUPER_ADMIN
 *
 * Phases du dossier (seuils en jours) :
 *   NORMAL → PRECONTENTIEUX → CONTENTIEUX → PERTE
 *
 * Idempotence : `niveauEscalade` mémorise le dernier palier déjà notifié ;
 * un palier n'est franchi (notif + ActionRecouvrementRIA) qu'une seule fois.
 */

import { prisma } from "@/lib/prisma";
import {
  Prisma,
  PrioriteNotification,
  PhaseRecouvrementRIA,
  StatutFinancementRIA,
  TypeActionRecouvrement,
} from "@prisma/client";
import { notify, notifyAdmins, type TxClient } from "@/lib/notifications";

// ─── Seuils (jours) — surchargeables via ConfigAlerteRIA (cle / valeur) ─────────

const DEFAUTS: Record<string, number> = {
  ria_retard_n1_jours: 1,
  ria_retard_n2_jours: 15,
  ria_retard_n3_jours: 30,
  ria_retard_n4_jours: 45,
  ria_retard_n5_jours: 60,
  ria_phase_precontentieux_jours: 60,
  ria_phase_contentieux_jours: 90,
  ria_phase_perte_jours: 180,
};

async function chargerSeuils(): Promise<Record<string, number>> {
  const rows = await prisma.configAlerteRIA.findMany({
    where: { cle: { in: Object.keys(DEFAUTS) } },
    select: { cle: true, valeur: true },
  });
  const map = { ...DEFAUTS };
  for (const r of rows) {
    const v = parseInt(r.valeur, 10);
    if (!Number.isNaN(v)) map[r.cle] = v;
  }
  return map;
}

function niveauPour(j: number, s: Record<string, number>): number {
  if (j >= s.ria_retard_n5_jours) return 5;
  if (j >= s.ria_retard_n4_jours) return 4;
  if (j >= s.ria_retard_n3_jours) return 3;
  if (j >= s.ria_retard_n2_jours) return 2;
  if (j >= s.ria_retard_n1_jours) return 1;
  return 0;
}

function phasePour(j: number, s: Record<string, number>): PhaseRecouvrementRIA {
  if (j >= s.ria_phase_perte_jours) return PhaseRecouvrementRIA.PERTE;
  if (j >= s.ria_phase_contentieux_jours) return PhaseRecouvrementRIA.CONTENTIEUX;
  if (j >= s.ria_phase_precontentieux_jours) return PhaseRecouvrementRIA.PRECONTENTIEUX;
  return PhaseRecouvrementRIA.NORMAL;
}

/** Garde uniquement les userIds réellement définis (filtre null/undefined). */
function ids(...vals: (number | null | undefined)[]): number[] {
  return vals.filter((v): v is number => typeof v === "number");
}

// ─── Type du financement chargé pour l'escalade ────────────────────────────────

const finInclude = {
  client: {
    select: {
      id: true,
      nom: true,
      prenom: true,
      agentTerrainId: true,
      pointDeVente: {
        select: { id: true, nom: true, rpvId: true, chefAgenceId: true },
      },
    },
  },
} satisfies Prisma.OperationFinancementRIAInclude;

type FinAvecClient = Prisma.OperationFinancementRIAGetPayload<{ include: typeof finInclude }>;

// ─── Définition d'un palier d'escalade ─────────────────────────────────────────

function paramsNiveau(niveau: number, fin: FinAvecClient): {
  type: TypeActionRecouvrement;
  cibles: number[];
  versAdmins: boolean;
  priorite: PrioriteNotification;
  libelle: string;
} {
  const pdv = fin.client.pointDeVente;
  switch (niveau) {
    case 1:
      return {
        type: TypeActionRecouvrement.NOTE_INTERNE,
        cibles: ids(fin.client.agentTerrainId),
        versAdmins: false,
        priorite: PrioriteNotification.NORMAL,
        libelle: "Relance automatique",
      };
    case 2:
      return {
        type: TypeActionRecouvrement.APPEL_TELEPHONIQUE,
        cibles: ids(fin.client.agentTerrainId),
        versAdmins: false,
        priorite: PrioriteNotification.NORMAL,
        libelle: "Alerte agent",
      };
    case 3:
      return {
        type: TypeActionRecouvrement.NOTE_INTERNE,
        cibles: ids(pdv?.chefAgenceId),
        versAdmins: false,
        priorite: PrioriteNotification.HAUTE,
        libelle: "Alerte chef d'agence",
      };
    case 4:
      return {
        type: TypeActionRecouvrement.MISE_EN_DEMEURE,
        cibles: ids(pdv?.rpvId),
        versAdmins: false,
        priorite: PrioriteNotification.HAUTE,
        libelle: "Alerte RVP",
      };
    default: // 5
      return {
        type: TypeActionRecouvrement.MISE_EN_DEMEURE,
        cibles: [],
        versAdmins: true,
        priorite: PrioriteNotification.URGENT,
        libelle: "Alerte Direction Générale",
      };
  }
}

/** Franchit un palier : trace ActionRecouvrementRIA + notifie la cible. */
async function escaladerNiveau(
  tx: TxClient,
  fin: FinAvecClient,
  niveau: number,
  joursRetard: number,
): Promise<void> {
  const c = paramsNiveau(niveau, fin);
  const clientNom = `${fin.client.prenom} ${fin.client.nom}`.trim();
  const montant = Number(fin.encours).toLocaleString("fr-FR");
  const actionUrl = `/dashboard/admin/ria/financements?financement=${fin.id}`;

  // Historique de recouvrement (réutilise le modèle existant)
  await tx.actionRecouvrementRIA.create({
    data: {
      financementId: fin.id,
      type: c.type,
      statut: "EN_COURS",
      notes: `Escalade niveau ${niveau} — ${c.libelle}. Retard de ${joursRetard} j sur ${fin.reference} (encours ${montant}).`,
      dateRelance: new Date(),
    },
  });

  // Notifications in-app
  const payload = {
    titre: `RIA · Niveau ${niveau} · ${c.libelle}`,
    message: `Client ${clientNom} — financement ${fin.reference} en retard de ${joursRetard} j (encours ${montant}).`,
    priorite: c.priorite,
    actionUrl,
  };
  if (c.cibles.length) await notify(tx, c.cibles, payload);
  if (c.versAdmins) await notifyAdmins(tx, payload);
}

// ─── Résultat du scan ───────────────────────────────────────────────────────────

export interface EscaladeResultat {
  scannes: number;          // financements échus avec encours > 0
  enRetard: number;         // joursRetard > 0
  escalades: number;        // financements ayant franchi ≥ 1 palier ce passage
  paliersFranchis: number;  // nb total de paliers franchis
  parNiveau: Record<number, number>;
  parPhase: Record<string, number>;
}

/**
 * Scan complet : calcule le retard de chaque financement RIA échu,
 * franchit les nouveaux paliers et met à jour statut/phase/jours.
 * Idempotent — peut être appelé plusieurs fois par jour sans double-notifier.
 */
export async function evaluerRetardsRIA(): Promise<EscaladeResultat> {
  const seuils = await chargerSeuils();
  const now = new Date();

  const financements = await prisma.operationFinancementRIA.findMany({
    where: {
      statut: { in: [StatutFinancementRIA.ACTIF, StatutFinancementRIA.EN_RETARD] },
      dateEcheance: { lt: now },
      encours: { gt: 0 },
    },
    include: finInclude,
  });

  const res: EscaladeResultat = {
    scannes: financements.length,
    enRetard: 0,
    escalades: 0,
    paliersFranchis: 0,
    parNiveau: {},
    parPhase: {},
  };

  for (const fin of financements) {
    const joursRetard = Math.floor(
      (now.getTime() - new Date(fin.dateEcheance!).getTime()) / 86_400_000,
    );
    if (joursRetard <= 0) continue;
    res.enRetard++;

    const niveauCible = niveauPour(joursRetard, seuils);
    const phaseCible = phasePour(joursRetard, seuils);

    // Rien de nouveau → on rafraîchit seulement le compteur de jours
    if (niveauCible <= fin.niveauEscalade && phaseCible === fin.phaseRecouvrement) {
      if (joursRetard !== fin.joursRetard) {
        await prisma.operationFinancementRIA.update({
          where: { id: fin.id },
          data: { joursRetard },
        });
      }
      continue;
    }

    // Statut dérivé de la phase / du niveau atteint
    const statut: StatutFinancementRIA =
      phaseCible === PhaseRecouvrementRIA.CONTENTIEUX || phaseCible === PhaseRecouvrementRIA.PERTE
        ? StatutFinancementRIA.DEFAUT
        : niveauCible >= 2
          ? StatutFinancementRIA.EN_RETARD
          : fin.statut;

    // Transition vers DEFAUT → immobiliser le capital (engage → bloque), une seule fois.
    const passeEnDefaut = statut === StatutFinancementRIA.DEFAUT && fin.statut !== StatutFinancementRIA.DEFAUT;

    await prisma.$transaction(async (tx) => {
      for (let n = fin.niveauEscalade + 1; n <= niveauCible; n++) {
        await escaladerNiveau(tx, fin, n, joursRetard);
        res.paliersFranchis++;
      }
      await tx.operationFinancementRIA.update({
        where: { id: fin.id },
        data: {
          joursRetard,
          niveauEscalade: niveauCible,
          phaseRecouvrement: phaseCible,
          statut,
          dateDernierEscalade: now,
        },
      });

      if (passeEnDefaut && Number(fin.encours) > 0) {
        await tx.portefeuilleRIA.update({
          where: { id: fin.portefeuilleId },
          data: {
            capitalEngage: { decrement: Number(fin.encours) },
            capitalBloque: { increment: Number(fin.encours) },
          },
        });
        await tx.mouvementFondsRIA.create({
          data: {
            type:           "AJUSTEMENT",
            montant:        fin.encours,
            sens:           "DEBIT",
            description:    `Passage en défaut (recouvrement) — financement ${fin.reference} immobilisé`,
            portefeuilleId: fin.portefeuilleId,
            financementId:  fin.id,
          },
        });
      }
    });

    res.escalades++;
    res.parNiveau[niveauCible] = (res.parNiveau[niveauCible] ?? 0) + 1;
    res.parPhase[phaseCible] = (res.parPhase[phaseCible] ?? 0) + 1;
  }

  return res;
}
