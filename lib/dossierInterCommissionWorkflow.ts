import type { Prisma, StatutDossierInterCommission, TypeCommissionRIA } from "@prisma/client";
import { isPresident } from "@/lib/authCommissionRIA";
import { ecritureFinancementRIA } from "@/lib/riaComptable";
import type { ContenuDemandeFinancement } from "@/lib/riaAnalyseDossier";

type TX = Prisma.TransactionClient;

export class DossierWorkflowError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type DossierAction =
  | "TRANSMETTRE"
  | "VALIDER_RECEPTION"
  | "METTRE_EN_ANALYSE"
  | "METTRE_EN_ATTENTE"
  | "APPROUVER"
  | "REJETER"
  | "DEMANDER_AJUSTEMENT"
  | "EXECUTER";

const TRANSITIONS: Record<DossierAction, StatutDossierInterCommission> = {
  TRANSMETTRE: "TRANSMIS",
  VALIDER_RECEPTION: "RECU",
  METTRE_EN_ANALYSE: "EN_ANALYSE",
  METTRE_EN_ATTENTE: "EN_ATTENTE_DECISION",
  APPROUVER: "APPROUVE",
  REJETER: "REJETE",
  // Retour à l'émettrice pour correction (Scénario 3) — pas un simple aller-retour TRANSMIS
  DEMANDER_AJUSTEMENT: "EN_PREPARATION",
  EXECUTER: "EXECUTE",
};

// Actions réservées au Président de la commission émettrice
const ACTIONS_PRESIDENT_EMETTRICE: DossierAction[] = ["TRANSMETTRE"];
// Décisions réservées au Président de la commission réceptrice (Scénario 2 & 4)
const ACTIONS_PRESIDENT_RECEPTRICE: DossierAction[] = ["APPROUVER", "REJETER", "DEMANDER_AJUSTEMENT", "EXECUTER"];
// Étapes de traitement ouvertes à tout membre actif de la commission réceptrice
const ACTIONS_MEMBRE_RECEPTRICE: DossierAction[] = ["VALIDER_RECEPTION", "METTRE_EN_ANALYSE", "METTRE_EN_ATTENTE"];

async function verifierDroitAction(
  tx: TX,
  dossier: { commissionEmettrice: TypeCommissionRIA; commissionReceptrice: TypeCommissionRIA },
  action: DossierAction,
  userId: number
) {
  if (ACTIONS_PRESIDENT_EMETTRICE.includes(action)) {
    const ok = await isPresident(userId, dossier.commissionEmettrice, tx);
    if (!ok) throw new DossierWorkflowError("Seul le Président de la commission émettrice peut transmettre ce dossier", 403);
    return;
  }
  if (ACTIONS_PRESIDENT_RECEPTRICE.includes(action)) {
    const ok = await isPresident(userId, dossier.commissionReceptrice, tx);
    if (!ok) throw new DossierWorkflowError("Seul le Président de la commission réceptrice peut effectuer cette action", 403);
    return;
  }
  if (ACTIONS_MEMBRE_RECEPTRICE.includes(action)) {
    const membre = await tx.membreCommissionRIA.findFirst({
      where: { userId, typeCommission: dossier.commissionReceptrice, actif: true },
    });
    if (!membre) throw new DossierWorkflowError("Réservé aux membres actifs de la commission réceptrice", 403);
  }
}

function refFin(): string {
  return `FIN-${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`;
}

// Scénario 4 — décaissement automatique : un OperationFinancementRIA par client,
// décrément du capital disponible du portefeuille choisi, mouvement de fonds + écriture comptable.
async function executerFinancement(
  tx: TX,
  params: { dossierId: number; reference: string; versionCourante: number; portefeuilleExecutionId: number; userId: number }
) {
  const version = await tx.versionDossierIC.findUnique({
    where: { dossierId_version: { dossierId: params.dossierId, version: params.versionCourante } },
  });
  const contenu = (version?.contenu ?? {}) as ContenuDemandeFinancement;
  const clients = contenu.clients ?? [];
  if (clients.length === 0) {
    throw new DossierWorkflowError("Aucun client à financer dans la version courante du dossier", 400);
  }

  const pf = await tx.portefeuilleRIA.findUnique({ where: { id: params.portefeuilleExecutionId } });
  if (!pf) throw new DossierWorkflowError("Portefeuille d'exécution introuvable", 404);

  const totalMontant = clients.reduce((s, c) => s + Number(c.montant || 0), 0);
  if (Number(pf.capitalDisponible) < totalMontant) {
    throw new DossierWorkflowError(
      `Capital disponible insuffisant — disponible: ${Number(pf.capitalDisponible).toLocaleString("fr-FR")} FCFA, requis: ${totalMontant.toLocaleString("fr-FR")} FCFA`,
      400
    );
  }

  for (const c of clients) {
    const montant = Number(c.montant || 0);
    if (montant <= 0) continue;

    const affectationActive = await tx.affectationClientRIA.findFirst({
      where: { portefeuilleId: params.portefeuilleExecutionId, clientId: c.clientId, actif: true },
    });

    const fin = await tx.operationFinancementRIA.create({
      data: {
        reference: refFin(),
        portefeuilleId: params.portefeuilleExecutionId,
        clientId: c.clientId,
        montantFinance: montant,
        encours: montant,
        affectationId: affectationActive?.id ?? null,
        notes: `Dossier inter-commission ${params.reference}`,
      },
    });

    await tx.portefeuilleRIA.update({
      where: { id: params.portefeuilleExecutionId },
      data: { capitalDisponible: { decrement: montant }, capitalEngage: { increment: montant } },
    });

    await tx.mouvementFondsRIA.create({
      data: {
        type: "FINANCEMENT_CLIENT",
        montant,
        sens: "DEBIT",
        description: `Financement client ${c.nom ?? c.clientId} — dossier ${params.reference} — réf. ${fin.reference}`,
        reference: fin.reference,
        portefeuilleId: params.portefeuilleExecutionId,
        financementId: fin.id,
      },
    });

    const clientInfo = await tx.client.findUnique({ where: { id: c.clientId }, select: { nom: true, prenom: true } });
    await ecritureFinancementRIA(tx, {
      montant,
      reference: fin.reference,
      clientNom: clientInfo ? `${clientInfo.prenom} ${clientInfo.nom}` : (c.nom ?? `Client ${c.clientId}`),
      portefeuilleRef: pf.reference,
      userId: params.userId,
    });
  }
}

export interface AppliquerActionParams {
  dossierId: number;
  userId: number;
  action?: DossierAction;
  montantApprouve?: number;
  portefeuilleExecutionId?: number;
  contenuRevise?: unknown;
  motifRevision?: string;
  commentaire?: string;
  titre?: string;
  description?: string;
  montantDemande?: number;
  // true pour Admin/SuperAdmin/RESPONSABLE_RIA — court-circuite le gating Président/membre
  skipGating?: boolean;
}

export async function appliquerActionDossier(tx: TX, params: AppliquerActionParams) {
  const { dossierId, userId, action } = params;

  const current = await tx.dossierInterCommission.findUnique({ where: { id: dossierId } });
  if (!current) throw new DossierWorkflowError("Dossier introuvable", 404);

  if (action && !params.skipGating) {
    await verifierDroitAction(tx, current, action, userId);
  }

  const data: Record<string, unknown> = {};

  if (action && TRANSITIONS[action]) {
    data.statut = TRANSITIONS[action];
    if (action === "APPROUVER") {
      data.valideParId = userId;
      data.dateValidation = new Date();
      if (params.montantApprouve !== undefined) data.montantApprouve = Number(params.montantApprouve);
      if (params.portefeuilleExecutionId !== undefined) data.portefeuilleExecutionId = Number(params.portefeuilleExecutionId);
    }
  }

  if (params.titre !== undefined) data.titre = params.titre;
  if (params.description !== undefined) data.description = params.description;
  if (params.montantDemande !== undefined) data.montantDemande = Number(params.montantDemande);

  if (params.contenuRevise !== undefined) {
    const newVersion = (current.versionCourante ?? 1) + 1;
    data.versionCourante = newVersion;
    await tx.versionDossierIC.create({
      data: {
        dossierId,
        version: newVersion,
        contenu: params.contenuRevise as Prisma.InputJsonValue,
        motif: params.motifRevision ?? action ?? "Révision",
        modifieParId: userId,
      },
    });
  }

  if (params.commentaire) {
    await tx.echangeInterCommission.create({
      data: {
        dossierId,
        auteurId: userId,
        commission: current.commissionReceptrice,
        type:
          action === "REJETER" ? "REJET"
          : action === "DEMANDER_AJUSTEMENT" ? "DEMANDE_AJUSTEMENT"
          : action === "APPROUVER" ? "VALIDATION"
          : "OBSERVATION",
        contenu: params.commentaire,
      },
    });
  }

  if (action === "EXECUTER" && current.type === "DEMANDE_FINANCEMENT") {
    if (current.statut !== "APPROUVE") {
      throw new DossierWorkflowError("Le dossier doit être approuvé avant exécution", 400);
    }
    const portefeuilleExecutionId = params.portefeuilleExecutionId ?? current.portefeuilleExecutionId;
    if (!portefeuilleExecutionId) {
      throw new DossierWorkflowError("Sélectionnez le portefeuille d'exécution avant de décaisser", 400);
    }
    await executerFinancement(tx, {
      dossierId,
      reference: current.reference,
      versionCourante: current.versionCourante,
      portefeuilleExecutionId,
      userId,
    });
    data.portefeuilleExecutionId = portefeuilleExecutionId;
  }

  return tx.dossierInterCommission.update({
    where: { id: dossierId },
    data,
    include: {
      creePar: { select: { id: true, nom: true, prenom: true } },
      validePar: { select: { id: true, nom: true, prenom: true } },
    },
  });
}
