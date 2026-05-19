import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { PAGES_REGISTRY } from "@/lib/pagesRegistry";
import { RoleGestionnaire } from "@prisma/client";

type Ctx = { params: Promise<{ userId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { userId } = await params;
    const uid = parseInt(userId);

    const gestionnaire = await prisma.gestionnaire.findUnique({
      where: { memberId: uid },
      select: { role: true },
    });

    if (!gestionnaire) {
      return NextResponse.json({ error: "Utilisateur non gestionnaire" }, { status: 404 });
    }

    const role = gestionnaire.role;
    const registry = PAGES_REGISTRY.find((r) => r.role === role);
    if (!registry) {
      return NextResponse.json({ error: "Rôle non trouvé dans le registre" }, { status: 404 });
    }

    // Role-level config, user overrides, and active modules in parallel
    const [roleRecords, userOverrides, activeModuleRecords] = await Promise.all([
      prisma.rolePageAccess.findMany({ where: { role } }),
      prisma.userPermission.findMany({ where: { userId: uid, permission: "PAGE_ACCESS" } }),
      prisma.systemModule.findMany({ where: { actif: true }, select: { key: true } }),
    ]);
    const roleDbMap = new Map(roleRecords.map((r) => [r.pageKey, r.allowed]));
    const userOverrideMap = new Map(userOverrides.map((r) => [r.module, r.granted]));
    const activeModuleSet = new Set(activeModuleRecords.map((m) => m.key));

    const data = registry.sections.map((s) => {
      const roleDefault = roleDbMap.has(s.key) ? roleDbMap.get(s.key)! : s.defaultAllowed;
      const userOverride = userOverrideMap.has(s.key) ? (userOverrideMap.get(s.key) ?? null) : null;
      const moduleBlocked = s.module !== null && !activeModuleSet.has(s.module);
      return {
        key: s.key,
        label: s.label,
        roleDefault,
        userOverride,
        effective: moduleBlocked ? false : (userOverride !== null ? userOverride : roleDefault),
        moduleBlocked,
      };
    });

    return NextResponse.json({ success: true, role, data });
  } catch (error) {
    console.error("GET /api/admin/acces-roles/[userId]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { userId } = await params;
    const uid = parseInt(userId);
    const grantedBy = parseInt(session.user.id);

    const { overrides } = await req.json() as {
      overrides: { key: string; granted: boolean | null }[];
    };

    await Promise.all(
      overrides.map(async (o) => {
        if (o.granted === null) {
          // Remove override — revert to role default
          await prisma.userPermission.deleteMany({
            where: { userId: uid, module: o.key, permission: "PAGE_ACCESS" },
          });
        } else {
          await prisma.userPermission.upsert({
            where: { userId_module_permission: { userId: uid, module: o.key, permission: "PAGE_ACCESS" } },
            create: { userId: uid, module: o.key, permission: "PAGE_ACCESS", granted: o.granted, grantedBy },
            update: { granted: o.granted, grantedBy },
          });
        }
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/admin/acces-roles/[userId]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
