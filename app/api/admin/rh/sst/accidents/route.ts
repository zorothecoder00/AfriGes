import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { GraviteSST } from "@prisma/client";
import { notifyNouvelAccidentTravail } from "@/lib/notificationsRH";

const INCLUDE = {
  profilRH: {
    select: {
      id: true, matricule: true,
      gestionnaire: { select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } } },
    },
  },
};

/**
 * GET /api/admin/rh/sst/accidents
 * Registre des accidents du travail. Query: profilRHId?, statut?, gravite?, page?, limit?
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const profilRHId = searchParams.get("profilRHId");
    const statut     = searchParams.get("statut");
    const gravite    = searchParams.get("gravite") as GraviteSST | null;
    const page       = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit      = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip       = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (profilRHId) where.profilRHId = Number(profilRHId);
    if (statut)     where.statut     = statut;
    if (gravite)    where.gravite    = gravite;

    const [accidents, total, statsByStatut, statsByGravite] = await Promise.all([
      prisma.accidentTravail.findMany({
        where, skip, take: limit,
        orderBy: { dateAccident: "desc" },
        include: INCLUDE,
      }),
      prisma.accidentTravail.count({ where }),
      prisma.accidentTravail.groupBy({ by: ["statut"], _count: { id: true } }),
      prisma.accidentTravail.groupBy({ by: ["gravite"], _count: { id: true } }),
    ]);

    return NextResponse.json({
      data: accidents,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: Object.fromEntries(statsByStatut.map((s) => [s.statut, s._count.id])),
      statsByGravite: Object.fromEntries(statsByGravite.map((s) => [s.gravite, s._count.id])),
    });
  } catch (error) {
    console.error("GET /api/admin/rh/sst/accidents", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/sst/accidents
 * Déclaration d'un accident du travail (la déclaration EST l'enregistrement).
 * Body: { profilRHId, dateAccident, heureAccident?, lieu, circonstances, natureLesion?,
 *         gravite?, arretTravail?, dureeArretJours?, temoin?, documentUrl?, notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const {
      profilRHId, dateAccident, heureAccident, lieu, circonstances, natureLesion,
      gravite, arretTravail, dureeArretJours, temoin, documentUrl, notes,
    } = body;

    if (!profilRHId || !dateAccident || !lieu || !circonstances) {
      return NextResponse.json({ error: "profilRHId, dateAccident, lieu et circonstances sont obligatoires" }, { status: 400 });
    }

    const accident = await prisma.accidentTravail.create({
      data: {
        profilRHId:        Number(profilRHId),
        dateAccident:      new Date(dateAccident),
        heureAccident:     heureAccident ?? null,
        lieu,
        circonstances,
        natureLesion:      natureLesion ?? null,
        gravite:           (gravite as GraviteSST) ?? "LEGER",
        arretTravail:      Boolean(arretTravail),
        dureeArretJours:   dureeArretJours ? Number(dureeArretJours) : null,
        temoin:            temoin ?? null,
        documentUrl:       documentUrl ?? null,
        notes:             notes ?? null,
        declareParId:      parseInt(session.user.id),
        statut:            "DECLARE",
      },
      include: INCLUDE,
    });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "CREATE", entite: "AccidentTravail", entiteId: accident.id,
        details: `Accident du travail déclaré pour profilRH #${profilRHId}` },
    });

    notifyNouvelAccidentTravail(accident.id).catch(() => {});

    return NextResponse.json({ data: accident }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/sst/accidents", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
