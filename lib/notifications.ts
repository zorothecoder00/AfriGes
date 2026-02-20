/**
 * lib/notifications.ts
 *
 * Utilitaires centralisés pour :
 *  - Envoyer des notifications à des utilisateurs ciblés par rôle
 *  - Créer des entrées d'audit log
 *
 * Utilisation dans les transactions Prisma :
 *   await notifyRoles(tx, ["MAGAZINIER", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {
 *     titre: "...",
 *     message: "...",
 *     priorite: PrioriteNotification.NORMAL,
 *     actionUrl: "/dashboard/...",
 *   });
 *
 * Matrice de notification recommandée :
 *  Action                      | Admin | RPV | Caissier | Magazinier | Logistique | Comptable
 *  ----------------------------|-------|-----|----------|------------|------------|----------
 *  Vente enregistrée (caissier)|  ✓    |  ✓  |    -     |    ✓       |     -      |    ✓
 *  Clôture caisse              |  ✓    |  ✓  |    -     |    -       |     -      |    ✓
 *  Mouvement stock (RPV)       |  ✓    |  -  |    -     |    ✓       |     ✓      |    -
 *  Nouveau / Modif produit     |  ✓    |  -  |    -     |    ✓       |     ✓      |    -
 *  Suppression produit         |  ✓(H) |  -  |    -     |    ✓(H)    |     ✓(H)   |    -
 *  Livraison planifiée         |  ✓    |  -  |    -     |    ✓       |     ✓      |    -
 *  Livraison validée           |  ✓    |  -  |    -     |    ✓       |     ✓      |    ✓
 *  Livraison annulée           |  ✓(H) |  -  |    -     |    ✓(H)    |     ✓(H)   |    -
 *  Réception logistique        |  ✓    |  ✓  |    -     |    ✓       |     -      |    -
 *  Affectation stock           |  ✓    |  ✓  |    -     |    ✓       |     -      |    -
 *  Ajustement magasinier       |  ✓    |  ✓  |    -     |    -       |     ✓      |    -
 *  Vente admin                 |  ✓    |  ✓  |    ✓     |    ✓       |     -      |    ✓
 */

import { PrioriteNotification, Prisma, Role } from "@prisma/client";

export type TxClient = Prisma.TransactionClient;

export interface NotifPayload {
  titre: string;
  message: string;
  priorite?: PrioriteNotification;
  actionUrl?: string;
}

// ─── Récupération des destinataires ──────────────────────────────────────────

/** Renvoie les IDs des utilisateurs ADMIN et SUPER_ADMIN */
async function getAdminIds(tx: TxClient): Promise<number[]> {
  const admins = await tx.user.findMany({
    where:  { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
    select: { id: true },
  });
  return admins.map((u) => u.id);
}

/**
 * Renvoie les IDs des utilisateurs liés à un ou plusieurs rôles de gestionnaire.
 * Seuls les gestionnaires actifs sont inclus.
 */
async function getGestionnaireIds(tx: TxClient, roles: string[]): Promise<number[]> {
  if (!roles.length) return [];
  const users = await tx.user.findMany({
    where:  { gestionnaire: { role: { in: roles as never[] }, actif: true } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

// ─── Fonctions d'envoi ────────────────────────────────────────────────────────

/**
 * Crée des notifications pour une liste d'IDs utilisateurs.
 * Les doublons sont automatiquement éliminés.
 */
export async function notify(
  tx: TxClient,
  userIds: number[],
  payload: NotifPayload
): Promise<void> {
  const unique = [...new Set(userIds)];
  if (!unique.length) return;
  await tx.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      titre:    payload.titre,
      message:  payload.message,
      priorite: payload.priorite ?? PrioriteNotification.NORMAL,
      actionUrl: payload.actionUrl ?? null,
    })),
    skipDuplicates: true,
  });
}

/** Notifie tous les ADMIN et SUPER_ADMIN */
export async function notifyAdmins(tx: TxClient, payload: NotifPayload): Promise<void> {
  const ids = await getAdminIds(tx);
  await notify(tx, ids, payload);
}

/**
 * Notifie des gestionnaires selon leur rôle.
 * Exemple : notifyGestionnaires(tx, ["MAGAZINIER", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {...})
 */
export async function notifyGestionnaires(
  tx: TxClient,
  roles: string[],
  payload: NotifPayload
): Promise<void> {
  const ids = await getGestionnaireIds(tx, roles);
  await notify(tx, ids, payload);
}

/**
 * Notifie les ADMIN/SUPER_ADMIN ET des gestionnaires par rôle en une seule opération.
 * C'est la fonction principale à utiliser dans la plupart des mutations.
 *
 * @param gestionnaireRoles - Liste de rôles RoleGestionnaire à notifier
 */
export async function notifyRoles(
  tx: TxClient,
  gestionnaireRoles: string[],
  payload: NotifPayload
): Promise<void> {
  const [adminIds, gestionnaireIds] = await Promise.all([
    getAdminIds(tx),
    getGestionnaireIds(tx, gestionnaireRoles),
  ]);
  await notify(tx, [...adminIds, ...gestionnaireIds], payload);
}

// ─── Audit log ────────────────────────────────────────────────────────────────

/**
 * Crée une entrée d'audit log dans la transaction courante.
 *
 * @param userId   - ID de l'utilisateur qui effectue l'action
 * @param action   - Code action (ex : "VENTE_CAISSIER", "RECEPTION_STOCK_RPV")
 * @param entite   - Nom de l'entité affectée (ex : "VenteCreditAlimentaire")
 * @param entiteId - ID de l'entité affectée (optionnel)
 */
export async function auditLog(
  tx: TxClient,
  userId: number,
  action: string,
  entite: string,
  entiteId?: number
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId,
      action,
      entite,
      ...(entiteId !== undefined && { entiteId }),
    },
  });
}
