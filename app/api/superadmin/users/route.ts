import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(100, Number(searchParams.get("limit") || 25));
    const skip   = (page - 1) * limit;
    const search = ( searchParams.get("search") || "" ).trim();
    const etat   = searchParams.get("etat")   || "";
    const role   = searchParams.get("role")   || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (etat) where.etat = etat;
    if (role) where.role = role;
    if (search) {
      const parts = search.split(/\s+/);
      const conditions: object[] = [
        { nom:    { contains: search, mode: "insensitive" } },
        { prenom: { contains: search, mode: "insensitive" } },
        { email:  { contains: search, mode: "insensitive" } },
      ];
      if (parts.length >= 2) {
        const [first, ...rest] = parts; const restStr = rest.join(" ");
        conditions.push({ AND: [{ prenom: { contains: first, mode: "insensitive" } }, { nom: { contains: restStr, mode: "insensitive" } }] });
        conditions.push({ AND: [{ nom: { contains: first, mode: "insensitive" } }, { prenom: { contains: restStr, mode: "insensitive" } }] });
      }
      where.OR = conditions;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, nom: true, prenom: true, email: true,
          telephone: true, role: true, etat: true,
          dateAdhesion: true, createdAt: true,
          gestionnaire:    { select: { role: true, actif: true } },
          userPermissions: { select: { module: true, permission: true, granted: true } },
          _count:          { select: { auditLogs: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const userIds = users.map((u) => u.id);
    const lastActivities = userIds.length > 0 ? await prisma.auditLog.findMany({
      where:    { userId: { in: userIds } },
      orderBy:  { createdAt: "desc" },
      distinct: ["userId"],
      select:   { userId: true, action: true, createdAt: true },
    }) : [];
    const activityMap = new Map(lastActivities.map((a) => [a.userId, a]));

    return NextResponse.json({
      data: users.map((u) => ({
        ...u,
        derniereActivite: activityMap.get(u.id) ?? null,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/superadmin/users", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
