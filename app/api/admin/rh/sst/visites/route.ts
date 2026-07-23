import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeVisiteMedicale, ResultatAptitude } from "@prisma/client";

const INCLUDE = {
  profilRH: {
    select: {
      id: true, matricule: true,
      gestionnaire: { select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } } },
    },
  },
};

/**
 * GET /api/admin/rh/sst/visites
 * Query: profilRHId?, resultatAptitude?, page?, limit?
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const profilRHId       = searchParams.get("profilRHId");
    const resultatAptitude = searchParams.get("resultatAptitude") as ResultatAptitude | null;
    const page  = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip  = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (profilRHId)       where.profilRHId       = Number(profilRHId);
    if (resultatAptitude) where.resultatAptitude = resultatAptitude;

    const [visites, total, stats] = await Promise.all([
      prisma.visiteMedicale.findMany({ where, skip, take: limit, orderBy: { dateVisite: "desc" }, include: INCLUDE }),
      prisma.visiteMedicale.count({ where }),
      prisma.visiteMedicale.groupBy({ by: ["resultatAptitude"], _count: { id: true } }),
    ]);

    return NextResponse.json({
      data: visites,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: Object.fromEntries(stats.map((s) => [s.resultatAptitude, s._count.id])),
    });
  } catch (error) {
    console.error("GET /api/admin/rh/sst/visites", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/sst/visites
 * Body: { profilRHId, type, dateVisite, medecin?, lieu?, resultatAptitude, restrictions?,
 *         dateProchaineVisite?, documentUrl?, notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const {
      profilRHId, type, dateVisite, medecin, lieu, resultatAptitude,
      restrictions, dateProchaineVisite, documentUrl, notes,
    } = body;

    if (!profilRHId || !type || !dateVisite || !resultatAptitude) {
      return NextResponse.json({ error: "profilRHId, type, dateVisite et resultatAptitude sont obligatoires" }, { status: 400 });
    }

    const visite = await prisma.visiteMedicale.create({
      data: {
        profilRHId:          Number(profilRHId),
        type:                type as TypeVisiteMedicale,
        dateVisite:          new Date(dateVisite),
        medecin:             medecin ?? null,
        lieu:                lieu ?? null,
        resultatAptitude:    resultatAptitude as ResultatAptitude,
        restrictions:        restrictions ?? null,
        dateProchaineVisite: dateProchaineVisite ? new Date(dateProchaineVisite) : null,
        documentUrl:         documentUrl ?? null,
        notes:               notes ?? null,
      },
      include: INCLUDE,
    });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "CREATE", entite: "VisiteMedicale", entiteId: visite.id,
        details: `Visite médicale (${type}) enregistrée pour profilRH #${profilRHId}` },
    });

    return NextResponse.json({ data: visite }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/sst/visites", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
