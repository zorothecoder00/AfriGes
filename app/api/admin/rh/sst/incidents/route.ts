import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeIncident, GraviteSST } from "@prisma/client";
import { notifyNouvelIncident } from "@/lib/notificationsRH";

/**
 * GET /api/admin/rh/sst/incidents
 * Query: statut?, typeIncident?, page?, limit?
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut       = searchParams.get("statut");
    const typeIncident = searchParams.get("typeIncident") as TypeIncident | null;
    const page  = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip  = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut)       where.statut       = statut;
    if (typeIncident) where.typeIncident = typeIncident;

    const [incidents, total, stats] = await Promise.all([
      prisma.rapportIncident.findMany({ where, skip, take: limit, orderBy: { dateIncident: "desc" } }),
      prisma.rapportIncident.count({ where }),
      prisma.rapportIncident.groupBy({ by: ["statut"], _count: { id: true } }),
    ]);

    return NextResponse.json({
      data: incidents,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: Object.fromEntries(stats.map((s) => [s.statut, s._count.id])),
    });
  } catch (error) {
    console.error("GET /api/admin/rh/sst/incidents", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/sst/incidents
 * Body: { dateIncident, lieu, typeIncident?, description, personnesImpliquees?, gravite?, documentUrl?, notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { dateIncident, lieu, typeIncident, description, personnesImpliquees, gravite, documentUrl, notes } = body;

    if (!dateIncident || !lieu || !description) {
      return NextResponse.json({ error: "dateIncident, lieu et description sont obligatoires" }, { status: 400 });
    }

    const incident = await prisma.rapportIncident.create({
      data: {
        dateIncident:        new Date(dateIncident),
        lieu,
        typeIncident:        (typeIncident as TypeIncident) ?? "AUTRE",
        description,
        personnesImpliquees: personnesImpliquees ?? null,
        gravite:             (gravite as GraviteSST) ?? "LEGER",
        documentUrl:         documentUrl ?? null,
        notes:               notes ?? null,
        declareParId:        parseInt(session.user.id),
        statut:              "OUVERT",
      },
    });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "CREATE", entite: "RapportIncident", entiteId: incident.id,
        details: `Incident déclaré — ${lieu}` },
    });

    notifyNouvelIncident(incident.id).catch(() => {});

    return NextResponse.json({ data: incident }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/sst/incidents", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
