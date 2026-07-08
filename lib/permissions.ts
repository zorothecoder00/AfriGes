// lib/permissions.ts
// Application (enforcement) du RBAC granulaire.
//
// Résolution effective d'une permission (module, action) pour un utilisateur :
//   1. ADMIN / SUPER_ADMIN → tout autorisé (bypass).
//   2. Override utilisateur  (UserPermission, permission = "ACTION:<action>")  ← priorité
//   3. Override rôle         (RolePermission)
//   4. Défaut registry       (DEFAULT_MATRIX)
//
// Le 1er niveau rencontré tranche. Absence à tous les niveaux = refusé.

import { NextResponse } from "next/server";
import type { RoleGestionnaire } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultActions, MODULE_KEYS, type PermissionAction } from "@/lib/permissionsRegistry";

type SessionLike = {
  user: { id: string | number; role?: string | null; gestionnaireRole?: string | null };
} | null | undefined;

function isAdmin(role?: string | null): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Renvoie true si l'utilisateur a le droit `action` sur `moduleKey`. */
export async function can(
  session: SessionLike,
  moduleKey: string,
  action: PermissionAction,
): Promise<boolean> {
  if (!session) return false;
  if (isAdmin(session.user.role)) return true;

  const userId = Number(session.user.id);
  const gest = (session.user.gestionnaireRole ?? null) as RoleGestionnaire | null;

  // 2. Override utilisateur (le plus prioritaire)
  const userOv = await prisma.userPermission.findUnique({
    where: { userId_module_permission: { userId, module: moduleKey, permission: `ACTION:${action}` } },
    select: { granted: true },
  });
  if (userOv) return userOv.granted;

  // 3. Override rôle
  if (gest) {
    const roleOv = await prisma.rolePermission.findUnique({
      where: { role_module_action: { role: gest, module: moduleKey, action } },
      select: { allowed: true },
    });
    if (roleOv) return roleOv.allowed;
  }

  // 4. Défaut registry
  return defaultActions(gest, moduleKey).includes(action);
}

/**
 * Garde de route : renvoie une réponse 403 si la permission manque, sinon null.
 *   const denied = await requirePermission(session, "credits", "VALIDATION");
 *   if (denied) return denied;
 */
export async function requirePermission(
  session: SessionLike,
  moduleKey: string,
  action: PermissionAction,
): Promise<NextResponse | null> {
  const ok = await can(session, moduleKey, action);
  if (ok) return null;
  return NextResponse.json(
    { error: `Permission refusée : ${action} sur ${moduleKey}` },
    { status: 403 },
  );
}

/**
 * Permissions effectives d'un utilisateur, tous modules confondus.
 * Renvoie { [moduleKey]: PermissionAction[] } — utilisé par /api/user/permissions
 * et le front pour masquer les boutons non autorisés.
 */
export async function resolveUserPermissions(
  session: SessionLike,
): Promise<Record<string, PermissionAction[]>> {
  const out: Record<string, PermissionAction[]> = {};
  if (!session) return out;

  const allActions: PermissionAction[] = ["LECTURE", "CREATION", "MODIFICATION", "VALIDATION", "EXPORT", "SUPPRESSION_LOGIQUE"];

  // Admin : tout, sur tous les modules.
  if (isAdmin(session.user.role)) {
    for (const m of MODULE_KEYS) out[m] = [...allActions];
    return out;
  }

  const userId = Number(session.user.id);
  const gest = (session.user.gestionnaireRole ?? null) as RoleGestionnaire | null;

  const [roleRows, userRows] = await Promise.all([
    gest ? prisma.rolePermission.findMany({ where: { role: gest }, select: { module: true, action: true, allowed: true } }) : Promise.resolve([]),
    prisma.userPermission.findMany({ where: { userId, permission: { startsWith: "ACTION:" } }, select: { module: true, permission: true, granted: true } }),
  ]);
  const roleMap = new Map(roleRows.map((r) => [`${r.module}:${r.action}`, r.allowed]));
  const userMap = new Map(userRows.map((r) => [`${r.module}:${r.permission.slice("ACTION:".length)}`, r.granted]));

  for (const m of MODULE_KEYS) {
    const allowed: PermissionAction[] = [];
    for (const a of allActions) {
      const uk = `${m}:${a}`;
      const eff = userMap.has(uk) ? userMap.get(uk)!
        : roleMap.has(uk) ? roleMap.get(uk)!
          : defaultActions(gest, m).includes(a);
      if (eff) allowed.push(a);
    }
    if (allowed.length) out[m] = allowed;
  }
  return out;
}
