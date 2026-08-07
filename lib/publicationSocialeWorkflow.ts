import type { Prisma, StatutPublicationSociale, PrioriteNotification } from "@prisma/client";
import { notifyRoles, auditLog } from "@/lib/notifications";

type TX = Prisma.TransactionClient;

export class PublicationWorkflowError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type PublicationAction =
  | "SOUMETTRE"
  | "VALIDER"
  | "VALIDER_DIRECTION"
  | "REJETER"
  | "PROGRAMMER"
  | "PUBLIER";

// VALIDER a une destination variable (résolue dans appliquerActionPublication
// selon niveauValidationRequis) — VALIDE n'est qu'un défaut/placeholder ici.
const TRANSITIONS: Record<PublicationAction, StatutPublicationSociale> = {
  SOUMETTRE:          "EN_REVISION",
  VALIDER:            "VALIDE",
  VALIDER_DIRECTION:  "VALIDE",
  REJETER:            "BROUILLON",
  PROGRAMMER:         "PROGRAMME",
  PUBLIER:            "PUBLIE",
};

// Statuts source autorisés par action — garantit la séquence du CDC §30-31
// (IDÉE→BROUILLON→EN RÉVISION→[EN VALIDATION DIRECTION]→VALIDÉ→PROGRAMMÉ→PUBLIÉ).
// Le gating de rôle (permission "marketing" + Direction=Admin/SuperAdmin pour
// VALIDER_DIRECTION) est fait en amont par l'appelant (requirePermission/estDirection).
const PRECONDITIONS: Record<PublicationAction, StatutPublicationSociale[]> = {
  SOUMETTRE:          ["BROUILLON"],
  VALIDER:            ["EN_REVISION"],
  VALIDER_DIRECTION:  ["EN_VALIDATION_DIRECTION"],
  REJETER:            ["EN_REVISION", "EN_VALIDATION_DIRECTION"],
  PROGRAMMER:         ["VALIDE"],
  PUBLIER:            ["PROGRAMME"],
};

export interface AppliquerActionPublicationParams {
  publicationId: number;
  userId: number;
  action: PublicationAction;
}

export async function appliquerActionPublication(tx: TX, params: AppliquerActionPublicationParams) {
  const { publicationId, userId, action } = params;

  const current = await tx.publicationSociale.findUnique({ where: { id: publicationId } });
  if (!current) throw new PublicationWorkflowError("Publication introuvable", 404);

  const allowed = PRECONDITIONS[action];
  if (!allowed.includes(current.statut)) {
    throw new PublicationWorkflowError(
      `Action « ${action} » impossible depuis le statut « ${current.statut} »`,
      409
    );
  }

  if (action === "PROGRAMMER" && !current.datePublicationPrevue) {
    throw new PublicationWorkflowError("Renseignez une date de publication prévue avant de programmer", 422);
  }

  const data: Record<string, unknown> = { statut: TRANSITIONS[action] };
  if (action === "VALIDER") {
    data.valideParId = userId;
    data.dateValidation = new Date();
    // CDC §31 — contenu à niveau DIRECTION : la validation marketing n'est que le 1er palier.
    if (current.niveauValidationRequis === "DIRECTION") {
      data.statut = "EN_VALIDATION_DIRECTION" satisfies StatutPublicationSociale;
    }
  }
  if (action === "VALIDER_DIRECTION") {
    data.valideParDirectionId = userId;
    data.dateValidationDirection = new Date();
  }
  if (action === "PUBLIER") {
    data.datePublication = new Date();
  }

  const updated = await tx.publicationSociale.update({
    where: { id: publicationId },
    data,
    include: {
      responsable: { select: { id: true, nom: true, prenom: true } },
      canal: true,
      campagne: { select: { id: true, code: true, nom: true } },
    },
  });

  await auditLog(tx, userId, `ACTION_PUBLICATION:${action}`, "PublicationSociale", publicationId, {
    avant: { statut: current.statut },
    apres: { statut: updated.statut },
  });

  const NOTIFS: Partial<Record<PublicationAction, { titre: string; message: string; priorite: PrioriteNotification; roles: string[] }>> = {
    SOUMETTRE: {
      titre: "Publication à valider",
      message: `La publication « ${updated.canal.libelle} » de ${updated.responsable.prenom} ${updated.responsable.nom} attend une validation.`,
      priorite: "NORMAL", roles: ["RESPONSABLE_MARKETING"],
    },
    REJETER: {
      titre: "Publication renvoyée en brouillon",
      message: `Une publication a été renvoyée en brouillon pour correction.`,
      priorite: "NORMAL", roles: ["RESPONSABLE_MARKETING", "COMMUNITY_MANAGER"],
    },
  };
  const conf = NOTIFS[action];
  if (conf) {
    await notifyRoles(tx, conf.roles, {
      titre: conf.titre,
      message: conf.message,
      priorite: conf.priorite,
      actionUrl: `/dashboard/admin/marketing/contenu`,
    });
  }
  // CDC §31 — 2e palier requis : la Direction (Admin/Super Admin) doit être alertée spécifiquement.
  if (action === "VALIDER" && updated.statut === "EN_VALIDATION_DIRECTION") {
    await notifyRoles(tx, [], {
      titre: "Publication en attente de validation Direction",
      message: `La publication « ${updated.canal.libelle} » de ${updated.responsable.prenom} ${updated.responsable.nom} a franchi le palier marketing — validation Direction requise.`,
      priorite: "HAUTE",
      actionUrl: `/dashboard/admin/marketing/contenu`,
    });
  }

  return updated;
}
