import { NextResponse } from "next/server";
import { RoleGestionnaire } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog } from "@/lib/notifications";
import {
  PERMISSION_MODULES, PERMISSION_ACTIONS, defaultActions,
} from "@/lib/permissionsRegistry";

type Ctx = { params: Promise<{ userId: string }> };

/**
 * GET /api/admin/permissions/user/[userId]
 * État effectif des permissions d'un utilisateur + indication des overrides
 * individuels (par rapport à son rôle et aux défauts).
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { userId } = await params;
  const uid = Number(userId);
  if (!uid) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const gestionnaire = await prisma.gestionnaire.findUnique({ where: { memberId: uid }, select: { role: true } });
  const role = (gestionnaire?.role ?? null) as RoleGestionnaire | null;

  const [roleRows, userRows] = await Promise.all([
    role ? prisma.rolePermission.findMany({ where: { role }, select: { module: true, action: true, allowed: true } }) : Promise.resolve([]),
    prisma.userPermission.findMany({ where: { userId: uid, permission: { startsWith: "ACTION:" } }, select: { module: true, permission: true, granted: true } }),
  ]);
  const roleMap = new Map(roleRows.map((r) => [`${r.module}:${r.action}`, r.allowed]));
  const userMap = new Map(userRows.map((r) => [`${r.module}:${r.permission.slice("ACTION:".length)}`, r.granted]));

  const data: Record<string, Record<string, { effective: boolean; overridden: boolean }>> = {};
  for (const m of PERMISSION_MODULES) {
    data[m.key] = {};
    for (const a of PERMISSION_ACTIONS) {
      const uk = `${m.key}:${a}`;
      const base = roleMap.has(uk) ? roleMap.get(uk)! : defaultActions(role, m.key).includes(a);
      const overridden = userMap.has(uk);
      data[m.key][a] = { effective: overridden ? userMap.get(uk)! : base, overridden };
    }
  }

  return NextResponse.json({ data, role });
}

/**
 * PUT /api/admin/permissions/user/[userId]
 * body = { entries: [{ module, action, granted: boolean | null }] }
 *   granted = null → retire l'override (retour au niveau rôle/défaut).
 */
export async function PUT(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { userId } = await params;
  const uid = Number(userId);
  if (!uid) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const entries = body?.entries as { module: string; action: string; granted: boolean | null }[] | undefined;
  if (!Array.isArray(entries) || !entries.length) {
    return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
  }

  const validModules = new Set(PERMISSION_MODULES.map((m) => m.key));
  const validActions = new Set<string>(PERMISSION_ACTIONS);
  const clean = entries.filter((e) => validModules.has(e.module) && validActions.has(e.action));
  if (!clean.length) return NextResponse.json({ error: "Entrées invalides" }, { status: 400 });

  const grantedBy = Number(session.user.id);
  await prisma.$transaction(
    clean.map((e) => {
      const permission = `ACTION:${e.action}`;
      if (e.granted === null) {
        return prisma.userPermission.deleteMany({ where: { userId: uid, module: e.module, permission } });
      }
      return prisma.userPermission.upsert({
        where: { userId_module_permission: { userId: uid, module: e.module, permission } },
        create: { userId: uid, module: e.module, permission, granted: e.granted, grantedBy },
        update: { granted: e.granted, grantedBy },
      });
    }),
  );
  await auditLog(prisma, grantedBy, "MAJ_PERMISSIONS_USER", "UserPermission", uid, { entries: clean });

  return NextResponse.json({ success: true });
}
