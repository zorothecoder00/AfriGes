import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { PAGES_REGISTRY } from "@/lib/pagesRegistry";
import { RoleGestionnaire } from "@prisma/client";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const [dbRecords, activeModuleRecords] = await Promise.all([
      prisma.rolePageAccess.findMany(),
      prisma.systemModule.findMany({ where: { actif: true }, select: { key: true } }),
    ]);
    const dbMap = new Map(dbRecords.map((r) => [`${r.role}:${r.pageKey}`, r.allowed]));
    const activeModules = activeModuleRecords.map((m) => m.key);

    // Merge registry defaults with DB overrides
    const result: Record<string, Record<string, boolean>> = {};
    for (const roleReg of PAGES_REGISTRY) {
      result[roleReg.role] = {};
      for (const section of roleReg.sections) {
        const key = `${roleReg.role}:${section.key}`;
        result[roleReg.role][section.key] = dbMap.has(key) ? dbMap.get(key)! : section.defaultAllowed;
      }
    }

    return NextResponse.json({ success: true, data: result, activeModules });
  } catch (error) {
    console.error("GET /api/admin/acces-roles", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { role, sections } = await req.json() as {
      role: string;
      sections: { key: string; allowed: boolean }[];
    };

    if (!role || !sections) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    const grantedBy = parseInt(session.user.id);

    await Promise.all(
      sections.map((s) =>
        prisma.rolePageAccess.upsert({
          where: { role_pageKey: { role: role as RoleGestionnaire, pageKey: s.key } },
          create: { role: role as RoleGestionnaire, pageKey: s.key, allowed: s.allowed, updatedBy: grantedBy },
          update: { allowed: s.allowed, updatedBy: grantedBy },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/admin/acces-roles", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
