import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutPointage } from "@prisma/client";
import { calculerPointage, getConfigHoraire } from "@/lib/calcPointage";

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
 * Saisie d'un pointage avec calculs automatiques (retard, heures sup, temps total).
 * Body: { profilRHId, date, statut, heureArrivee?, heureDepart?, notes?, justificatif? }
 *
 * POST bulk: { pointages: [{ profilRHId, date, statut, ... }] }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();

    // ── Bulk ──────────────────────────────────────────────────
    if (Array.isArray(body.pointages)) {
      const results = await prisma.$transaction(async (tx) => {
        const created = [];
        for (const p of body.pointages as { profilRHId: number; date: string; statut: string; heureArrivee?: string; heureDepart?: string; notes?: string; justificatif?: string }[]) {
          const dateObj    = new Date(p.date);
          const arrivee    = p.heureArrivee ? new Date(p.heureArrivee) : null;
          const depart     = p.heureDepart  ? new Date(p.heureDepart)  : null;
          const config     = await getConfigHoraire(tx, Number(p.profilRHId));
          const calcul     = calculerPointage(arrivee, depart, config, dateObj, p.statut);
          created.push(await tx.pointage.upsert({
            where:  { profilRHId_date: { profilRHId: Number(p.profilRHId), date: dateObj } },
            create: { profilRHId: Number(p.profilRHId), date: dateObj, statut: calcul.statutAuto as StatutPointage, heureArrivee: arrivee, heureDepart: depart, notes: p.notes ?? null, justificatif: p.justificatif ?? null, saisieParId: parseInt(session.user.id), source: "MANUEL", tempsTotal: calcul.tempsTotal, retardMinutes: calcul.retardMinutes, heuresSup: calcul.heuresSup },
            update: { statut: calcul.statutAuto as StatutPointage, heureArrivee: arrivee, heureDepart: depart, notes: p.notes ?? null, justificatif: p.justificatif ?? null, tempsTotal: calcul.tempsTotal, retardMinutes: calcul.retardMinutes, heuresSup: calcul.heuresSup },
          }));
        }
        return created;
      });
      return NextResponse.json({ data: results, count: results.length }, { status: 201 });
    }

    // ── Unitaire ──────────────────────────────────────────────
    const { profilRHId, date, statut, heureArrivee, heureDepart, notes, justificatif } = body;
    if (!profilRHId || !date || !statut) {
      return NextResponse.json({ error: "profilRHId, date et statut sont obligatoires" }, { status: 400 });
    }

    const dateObj = new Date(date);
    const arrivee = heureArrivee ? new Date(heureArrivee) : null;
    const depart  = heureDepart  ? new Date(heureDepart)  : null;
    const config  = await getConfigHoraire(prisma, Number(profilRHId));
    const calcul  = calculerPointage(arrivee, depart, config, dateObj, statut);

    const pointage = await prisma.pointage.upsert({
      where:  { profilRHId_date: { profilRHId: Number(profilRHId), date: dateObj } },
      create: { profilRHId: Number(profilRHId), date: dateObj, statut: calcul.statutAuto as StatutPointage, heureArrivee: arrivee, heureDepart: depart, notes: notes ?? null, justificatif: justificatif ?? null, saisieParId: parseInt(session.user.id), source: "MANUEL", tempsTotal: calcul.tempsTotal, retardMinutes: calcul.retardMinutes, heuresSup: calcul.heuresSup },
      update: { statut: calcul.statutAuto as StatutPointage, heureArrivee: arrivee, heureDepart: depart, notes: notes ?? null, justificatif: justificatif ?? null, tempsTotal: calcul.tempsTotal, retardMinutes: calcul.retardMinutes, heuresSup: calcul.heuresSup },
    });

    return NextResponse.json({ data: pointage }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/pointages", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
