import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { PAGES_REGISTRY } from "@/lib/pagesRegistry";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    // Admins ont accès à tout
    if (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN") {
      const all = PAGES_REGISTRY.flatMap((r) => r.sections.map((s) => s.key));
      return NextResponse.json({ allowedPages: all });
    }

    const userId = parseInt(session.user.id);

    const gestionnaire = await prisma.gestionnaire.findUnique({
      where: { memberId: userId },
      select: { role: true },
    });

    if (!gestionnaire) {
      return NextResponse.json({ allowedPages: [] });
    }

    const role = gestionnaire.role;
    const registry = PAGES_REGISTRY.find((r) => r.role === role);
    if (!registry) return NextResponse.json({ allowedPages: [] });

    // Role-level config
    const roleRecords = await prisma.rolePageAccess.findMany({ where: { role } });
    const roleDbMap = new Map(roleRecords.map((r) => [r.pageKey, r.allowed]));

    // Individual user overrides
    const userOverrides = await prisma.userPermission.findMany({
      where: { userId, permission: "PAGE_ACCESS" },
    });
    const userOverrideMap = new Map(userOverrides.map((r) => [r.module, r.granted]));

    // Active modules — inactive module = hard block on all linked sections
    const activeModules = await prisma.systemModule.findMany({
      where: { actif: true },
      select: { key: true },
    });
    const activeModuleSet = new Set(activeModules.map((m) => m.key));

    const allowedPages = registry.sections
      .filter((s) => {
        // Hard block: module globally disabled
        if (s.module !== null && !activeModuleSet.has(s.module)) return false;
        const roleValue = roleDbMap.has(s.key) ? roleDbMap.get(s.key)! : s.defaultAllowed;
        const userOverride = userOverrideMap.has(s.key) ? (userOverrideMap.get(s.key) ?? null) : null;
        return userOverride !== null ? userOverride : roleValue;
      })
      .map((s) => s.key);

    return NextResponse.json({ allowedPages });
  } catch (error) {
    console.error("GET /api/user/page-access", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
