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
  | "REJETER"
  | "PROGRAMMER"
  | "PUBLIER";

const TRANSITIONS: Record<PublicationAction, StatutPublicationSociale> = {
  SOUMETTRE:  "EN_REVISION",
  VALIDER:    "VALIDE",
  REJETER:    "BROUILLON",
  PROGRAMMER: "PROGRAMME",
  PUBLIER:    "PUBLIE",
};

// Statuts source autorisés par action — garantit la séquence du CDC §30
// (IDÉE→BROUILLON→EN RÉVISION→VALIDÉ→PROGRAMMÉ→PUBLIÉ). Le gating de rôle
// (permission "marketing") est fait en amont par l'appelant (requirePermission).
const PRECONDITIONS: Record<PublicationAction, StatutPublicationSociale[]> = {
  SOUMETTRE:  ["BROUILLON"],
  VALIDER:    ["EN_REVISION"],
  REJETER:    ["EN_REVISION"],
  PROGRAMMER: ["VALIDE"],
  PUBLIER:    ["PROGRAMME"],
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

  const NOTIFS: Partial<Record<PublicationAction, { titre: string; message: string; priorite: PrioriteNotification }>> = {
    SOUMETTRE: {
      titre: "Publication à valider",
      message: `La publication « ${updated.canal.libelle} » de ${updated.responsable.prenom} ${updated.responsable.nom} attend une validation.`,
      priorite: "NORMAL",
    },
    REJETER: {
      titre: "Publication renvoyée en brouillon",
      message: `Une publication a été renvoyée en brouillon pour correction.`,
      priorite: "NORMAL",
    },
  };
  const conf = NOTIFS[action];
  if (conf) {
    await notifyRoles(tx, ["RESPONSABLE_MARKETING"], {
      titre: conf.titre,
      message: conf.message,
      priorite: conf.priorite,
      actionUrl: `/dashboard/admin/marketing/contenu`,
    });
  }

  return updated;
}
