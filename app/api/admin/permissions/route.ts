import { NextResponse } from "next/server";
import { RoleGestionnaire } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog } from "@/lib/notifications";
import {
  DEFAULT_MATRIX, PERMISSION_MODULES, PERMISSION_ACTIONS, ACTION_LABEL,
  defaultActions,
} from "@/lib/permissionsRegistry";

/**
 * GET /api/admin/permissions
 * Matrice RBAC par rôle : pour chaque rôle géré, l'état effectif de chaque
 * (module, action) = override DB (RolePermission) sinon défaut du registry.
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const roles = Object.keys(DEFAULT_MATRIX);
  const overrides = await prisma.rolePermission.findMany({
    select: { role: true, module: true, action: true, allowed: true },
  });
  const dbMap = new Map(overrides.map((o) => [`${o.role}:${o.module}:${o.action}`, o.allowed]));

  const data: Record<string, Record<string, Record<string, boolean>>> = {};
  for (const role of roles) {
    data[role] = {};
    for (const m of PERMISSION_MODULES) {
      data[role][m.key] = {};
      for (const a of PERMISSION_ACTIONS) {
        const key = `${role}:${m.key}:${a}`;
        data[role][m.key][a] = dbMap.has(key)
          ? dbMap.get(key)!
          : defaultActions(role, m.key).includes(a);
      }
    }
  }

  return NextResponse.json({
    data,
    roles,
    modules: PERMISSION_MODULES,
    actions: PERMISSION_ACTIONS.map((a) => ({ key: a, label: ACTION_LABEL[a] })),
  });
}

/**
 * PUT /api/admin/permissions
 * body = { role, entries: [{ module, action, allowed }] }
 * Upsert des overrides de rôle (RolePermission).
 */
export async function PUT(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const role = body?.role as string | undefined;
  const entries = body?.entries as { module: string; action: string; allowed: boolean }[] | undefined;

  if (!role || !Object.values(RoleGestionnaire).includes(role as RoleGestionnaire)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
  }
  if (!Array.isArray(entries) || !entries.length) {
    return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
  }

  const validModules = new Set(PERMISSION_MODULES.map((m) => m.key));
  const validActions = new Set<string>(PERMISSION_ACTIONS);
  const clean = entries.filter((e) => validModules.has(e.module) && validActions.has(e.action) && typeof e.allowed === "boolean");
  if (!clean.length) return NextResponse.json({ error: "Entrées invalides" }, { status: 400 });

  const updatedBy = Number(session.user.id);
  await prisma.$transaction(
    clean.map((e) =>
      prisma.rolePermission.upsert({
        where: { role_module_action: { role: role as RoleGestionnaire, module: e.module, action: e.action } },
        create: { role: role as RoleGestionnaire, module: e.module, action: e.action, allowed: e.allowed, updatedBy },
        update: { allowed: e.allowed, updatedBy },
      }),
    ),
  );
  await auditLog(prisma, updatedBy, "MAJ_PERMISSIONS_ROLE", "RolePermission", 0, { role, entries: clean });

  return NextResponse.json({ success: true });
}
