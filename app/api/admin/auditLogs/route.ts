import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/admin/auditLogs
 * Liste les audit logs avec pagination, filtres et stats
 * Accessible par tout utilisateur authentifie (lecture seule)
 */
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 10)));
    const skip = (page - 1) * limit;
    const action = searchParams.get("action") || "";
    const entite = searchParams.get("entite") || "";
    const userId = searchParams.get("userId") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search") || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (action) {
      where.action = { contains: action, mode: "insensitive" };
    }

    if (entite) {
      where.entite = { contains: entite, mode: "insensitive" };
    }

    if (userId) {
      where.userId = Number(userId);
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { entite: { contains: search, mode: "insensitive" } },
        { user: { nom: { contains: search, mode: "insensitive" } } },
        { user: { prenom: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, nom: true, prenom: true, email: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalActions, actionsToday, distinctEntites] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.auditLog.findMany({
        select: { entite: true },
        distinct: ["entite"],
      }),
    ]);

    return NextResponse.json({
      data: logs,
      stats: {
        totalActions,
        actionsToday,
        entitesDistinctes: distinctEntites.length,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /admin/auditLogs error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des audit logs" },
      { status: 500 }
    );
  }
}
