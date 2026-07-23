import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeEvenementSST } from "@prisma/client";

/**
 * GET /api/admin/rh/sst/registre
 * Journal des événements SST hors accident (inspections, formations sécurité, presque-accidents…).
 * Query: type?, page?, limit?
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const type  = searchParams.get("type") as TypeEvenementSST | null;
    const page  = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip  = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (type) where.type = type;

    const [entries, total, stats] = await Promise.all([
      prisma.registreSST.findMany({ where, skip, take: limit, orderBy: { dateEvenement: "desc" } }),
      prisma.registreSST.count({ where }),
      prisma.registreSST.groupBy({ by: ["type"], _count: { id: true } }),
    ]);

    return NextResponse.json({
      data: entries,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: Object.fromEntries(stats.map((s) => [s.type, s._count.id])),
    });
  } catch (error) {
    console.error("GET /api/admin/rh/sst/registre", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/sst/registre
 * Body: { type, dateEvenement, description, lieu?, actionsPrises?, documentUrl?, notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { type, dateEvenement, description, lieu, actionsPrises, documentUrl, notes } = body;

    if (!type || !dateEvenement || !description) {
      return NextResponse.json({ error: "type, dateEvenement et description sont obligatoires" }, { status: 400 });
    }

    const entry = await prisma.registreSST.create({
      data: {
        type:          type as TypeEvenementSST,
        dateEvenement: new Date(dateEvenement),
        description,
        lieu:          lieu ?? null,
        actionsPrises: actionsPrises ?? null,
        documentUrl:   documentUrl ?? null,
        notes:         notes ?? null,
        responsableId: parseInt(session.user.id),
      },
    });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "CREATE", entite: "RegistreSST", entiteId: entry.id, details: `Entrée SST (${type}) ajoutée` },
    });

    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/sst/registre", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
