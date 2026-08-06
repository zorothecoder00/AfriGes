import type { Prisma, StatutCampagne, PrioriteNotification } from "@prisma/client";
import { notifyRoles, auditLog } from "@/lib/notifications";

type TX = Prisma.TransactionClient;

export class CampagneWorkflowError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type CampagneAction =
  | "SOUMETTRE"
  | "APPROUVER"
  | "REJETER"
  | "ACTIVER"
  | "METTRE_EN_PAUSE"
  | "REPRENDRE"
  | "TERMINER"
  | "ARCHIVER";

const TRANSITIONS: Record<CampagneAction, StatutCampagne> = {
  SOUMETTRE:       "PLANIFIEE",
  APPROUVER:       "APPROUVEE",
  REJETER:         "BROUILLON", // renvoyée en préparation pour correction
  ACTIVER:         "ACTIVE",
  METTRE_EN_PAUSE: "PAUSE",
  REPRENDRE:       "ACTIVE",
  TERMINER:        "TERMINEE",
  ARCHIVER:        "ARCHIVEE",
};

// Statuts source autorisés par action — garantit la séquence du CDC §6.
// Le gating de rôle (permission "marketing") est fait en amont par l'appelant
// (requirePermission côté route) ; ce module ne vérifie que l'intégrité du flux.
const PRECONDITIONS: Record<CampagneAction, StatutCampagne[]> = {
  SOUMETTRE:       ["BROUILLON"],
  APPROUVER:       ["PLANIFIEE"],
  REJETER:         ["PLANIFIEE"],
  ACTIVER:         ["APPROUVEE"],
  METTRE_EN_PAUSE: ["ACTIVE"],
  REPRENDRE:       ["PAUSE"],
  TERMINER:        ["ACTIVE", "PAUSE"],
  ARCHIVER:        ["TERMINEE"],
};

export interface AppliquerActionCampagneParams {
  campagneId: number;
  userId: number;
  action: CampagneAction;
  commentaire?: string;
}

export async function appliquerActionCampagne(tx: TX, params: AppliquerActionCampagneParams) {
  const { campagneId, userId, action } = params;

  const current = await tx.campagne.findUnique({ where: { id: campagneId } });
  if (!current) throw new CampagneWorkflowError("Campagne introuvable", 404);

  const allowed = PRECONDITIONS[action];
  if (!allowed.includes(current.statut)) {
    throw new CampagneWorkflowError(
      `Action « ${action} » impossible depuis le statut « ${current.statut} »`,
      409
    );
  }

  const nouveauStatut = TRANSITIONS[action];

  const updated = await tx.campagne.update({
    where: { id: campagneId },
    data: { statut: nouveauStatut },
    include: {
      responsable: { select: { id: true, nom: true, prenom: true } },
      typeCampagne: true,
      budget: true,
      objectifs: true,
    },
  });

  await auditLog(tx, userId, `ACTION_CAMPAGNE:${action}`, "Campagne", campagneId, {
    avant: { statut: current.statut },
    apres: { statut: nouveauStatut },
    commentaire: params.commentaire ?? null,
  });

  // ── Notifications automatiques (CDC §80) ─────────────────────────────────
  const NOTIFS: Partial<Record<CampagneAction, { titre: string; message: string; priorite: PrioriteNotification }>> = {
    SOUMETTRE: {
      titre: "Campagne à approuver",
      message: `La campagne « ${current.nom} » (${current.code}) a été soumise et attend une approbation.`,
      priorite: "HAUTE",
    },
    APPROUVER: {
      titre: "Campagne approuvée",
      message: `La campagne « ${current.nom} » (${current.code}) a été approuvée.`,
      priorite: "NORMAL",
    },
    REJETER: {
      titre: "Campagne renvoyée en brouillon",
      message: `La campagne « ${current.nom} » (${current.code}) a été renvoyée en brouillon pour correction.`,
      priorite: "HAUTE",
    },
    TERMINER: {
      titre: "Campagne terminée",
      message: `La campagne « ${current.nom} » (${current.code}) est terminée.`,
      priorite: "NORMAL",
    },
  };
  const conf = NOTIFS[action];
  if (conf) {
    await notifyRoles(tx, ["RESPONSABLE_MARKETING"], {
      titre: conf.titre,
      message: conf.message,
      priorite: conf.priorite,
      actionUrl: `/dashboard/admin/marketing/campagnes/${campagneId}`,
    });
  }

  return updated;
}
