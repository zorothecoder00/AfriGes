import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutPointage } from "@prisma/client";

/**
 * GET /api/admin/rh/pointages
 * Query: profilRHId, date (YYYY-MM-DD), mois, annee, statut, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const profilRHId = searchParams.get("profilRHId");
    const dateParam  = searchParams.get("date");
    const mois       = searchParams.get("mois");
    const annee      = searchParams.get("annee");
    const statut     = searchParams.get("statut") as StatutPointage | null;
    const search     = searchParams.get("search")?.trim() ?? "";
    const page       = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit      = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 31)));
    const skip       = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (profilRHId) where.profilRHId = Number(profilRHId);
    if (statut)     where.statut     = statut;
    if (dateParam) {
      const d = new Date(dateParam);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      where.date = { gte: d, lt: next };
    } else if (mois && annee) {
      const m = Number(mois); const y = Number(annee);
      where.date = {
        gte: new Date(y, m - 1, 1),
        lt:  new Date(y, m, 1),
      };
    }
    if (search) {
      where.profilRH = {
        gestionnaire: { member: { OR: [
          { nom:    { contains: search, mode: "insensitive" } },
          { prenom: { contains: search, mode: "insensitive" } },
        ]}},
      };
    }

    const [pointages, total, stats] = await Promise.all([
      prisma.pointage.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: "desc" }],
        include: {
          profilRH: {
            select: {
              id: true, matricule: true,
              gestionnaire: { select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } } },
            },
          },
        },
      }),
      prisma.pointage.count({ where }),
      prisma.pointage.groupBy({ by: ["statut"], _count: { id: true }, where: dateParam ? where : (mois && annee ? where : undefined) }),
    ]);

    const statsMap = Object.fromEntries(stats.map((s) => [s.statut, s._count.id]));
    return NextResponse.json({
      data: pointages,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: statsMap,
    });
  } catch (error) {
    console.error("GET /api/admin/rh/pointages", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/pointages
 * Saisie d'un pointage unique
 * Body: { profilRHId, date, statut, heureArrivee?, heureDepart?, notes? }
 *
 * POST bulk: { pointages: [{ profilRHId, date, statut, ... }] }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();

    // Bulk
    if (Array.isArray(body.pointages)) {
      const created = await prisma.$transaction(
        body.pointages.map((p: { profilRHId: number; date: string; statut: string; heureArrivee?: string; heureDepart?: string; notes?: string }) =>
          prisma.pointage.upsert({
            where: { profilRHId_date: { profilRHId: Number(p.profilRHId), date: new Date(p.date) } },
            create: {
              profilRHId:   Number(p.profilRHId),
              date:         new Date(p.date),
              statut:       p.statut as StatutPointage,
              heureArrivee: p.heureArrivee ? new Date(p.heureArrivee) : null,
              heureDepart:  p.heureDepart  ? new Date(p.heureDepart)  : null,
              notes:        p.notes        ?? null,
              saisieParId:  parseInt(session.user.id),
              source:       "MANUEL",
            },
            update: {
              statut:       p.statut as StatutPointage,
              heureArrivee: p.heureArrivee ? new Date(p.heureArrivee) : null,
              heureDepart:  p.heureDepart  ? new Date(p.heureDepart)  : null,
              notes:        p.notes        ?? null,
            },
          })
        )
      );
      return NextResponse.json({ data: created, count: created.length }, { status: 201 });
    }

    // Unitaire
    const { profilRHId, date, statut, heureArrivee, heureDepart, notes } = body;
    if (!profilRHId || !date || !statut) {
      return NextResponse.json({ error: "profilRHId, date et statut sont obligatoires" }, { status: 400 });
    }

    const pointage = await prisma.pointage.upsert({
      where: { profilRHId_date: { profilRHId: Number(profilRHId), date: new Date(date) } },
      create: {
        profilRHId:   Number(profilRHId),
        date:         new Date(date),
        statut:       statut as StatutPointage,
        heureArrivee: heureArrivee ? new Date(heureArrivee) : null,
        heureDepart:  heureDepart  ? new Date(heureDepart)  : null,
        notes:        notes        ?? null,
        saisieParId:  parseInt(session.user.id),
        source:       "MANUEL",
      },
      update: {
        statut:       statut as StatutPointage,
        heureArrivee: heureArrivee ? new Date(heureArrivee) : null,
        heureDepart:  heureDepart  ? new Date(heureDepart)  : null,
        notes:        notes        ?? null,
      },
    });

    return NextResponse.json({ data: pointage }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/pointages", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
