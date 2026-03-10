import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page    = Math.max(1, Number(searchParams.get("page")   || 1));
    const limit   = Math.min(100, Number(searchParams.get("limit")  || 30));
    const skip    = (page - 1) * limit;
    const search  = searchParams.get("search")  || "";
    const action  = searchParams.get("action")  || "";
    const entite  = searchParams.get("entite")  || "";
    const userId  = searchParams.get("userId")  || "";
    const dateFrom= searchParams.get("dateFrom")|| "";
    const dateTo  = searchParams.get("dateTo")  || "";
    const type    = searchParams.get("type")    || "audit"; // audit | security

    if (type === "security") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (action) where.action = { contains: action, mode: "insensitive" };
      if (userId) where.userId = parseInt(userId);
      if (dateFrom) where.createdAt = { ...where.createdAt, gte: new Date(dateFrom) };
      if (dateTo)   where.createdAt = { ...where.createdAt, lte: new Date(dateTo) };
      if (search)   where.OR = [{ userEmail: { contains: search, mode: "insensitive" } }, { details: { contains: search, mode: "insensitive" } }];

      const [logs, total] = await Promise.all([
        prisma.securityLog.findMany({
          where, skip, take: limit,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { nom: true, prenom: true, role: true } } },
        }),
        prisma.securityLog.count({ where }),
      ]);
      return NextResponse.json({ data: logs, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
    }

    // Audit logs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (action) where.action  = { contains: action, mode: "insensitive" };
    if (entite) where.entite  = { contains: entite, mode: "insensitive" };
    if (userId) where.userId  = parseInt(userId);
    if (dateFrom) where.createdAt = { ...where.createdAt, gte: new Date(dateFrom) };
    if (dateTo)   where.createdAt = { ...where.createdAt, lte: new Date(dateTo) };
    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { entite: { contains: search, mode: "insensitive" } },
        { user: { OR: [{ nom: { contains: search, mode: "insensitive" } }, { prenom: { contains: search, mode: "insensitive" } }] } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { nom: true, prenom: true, email: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ data: logs, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("GET /api/superadmin/audit-logs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
