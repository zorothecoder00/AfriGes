import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { StatutPointage } from "@prisma/client";
import { calculerPointage, getConfigHoraire } from "@/lib/calcPointage";

async function getPdvScope(session: Awaited<ReturnType<typeof getRHSession>>) {
  const isAdmin = session!.user.role === "ADMIN" || session!.user.role === "SUPER_ADMIN";
  if (isAdmin) return null;
  const aff = await prisma.gestionnaireAffectation.findFirst({
    where:  { userId: parseInt(session!.user.id), actif: true },
    select: { pointDeVenteId: true },
  });
  return aff?.pointDeVenteId ?? null;
}

async function getTeamProfilIds(pdvId: number | null): Promise<number[] | null> {
  if (!pdvId) return null;
  const pdvUsers = await prisma.gestionnaireAffectation.findMany({
    where:  { pointDeVenteId: pdvId, actif: true },
    select: { userId: true },
  });
  const userIds = pdvUsers.map((u) => u.userId);
  const profils = await prisma.profilRH.findMany({
    where:  { gestionnaire: { member: { id: { in: userIds } } } },
    select: { id: true },
  });
  return profils.map((p) => p.id);
}

/**
 * GET /api/responsableRH/pointages
 * Query: profilRHId, date (YYYY-MM-DD), mois, annee, statut, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const pdvId   = await getPdvScope(session);
    const teamIds = await getTeamProfilIds(pdvId);

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
    if (teamIds)    where.profilRHId = { in: teamIds };
    if (profilRHId) where.profilRHId = Number(profilRHId); // override — collab spécifique
    if (statut)     where.statut     = statut;

    if (dateParam) {
      const d = new Date(dateParam);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      where.date = { gte: d, lt: next };
    } else if (mois && annee) {
      const m = Number(mois); const y = Number(annee);
      where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }

    if (search) {
      where.profilRH = {
        gestionnaire: {
          member: {
            OR: [
              { nom:    { contains: search, mode: "insensitive" } },
              { prenom: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      };
    }

    const [pointages, total, stats] = await Promise.all([
      prisma.pointage.findMany({
        where,
        skip,
        take:    limit,
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
      prisma.pointage.groupBy({
        by:    ["statut"],
        _count: { id: true },
        where:  dateParam || (mois && annee) ? where : (teamIds ? { profilRHId: { in: teamIds } } : {}),
      }),
    ]);

    return NextResponse.json({
      data:  pointages,
      meta:  { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: Object.fromEntries(stats.map((s) => [s.statut, s._count.id])),
    });
  } catch (error) {
    console.error("GET /api/responsableRH/pointages", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/responsableRH/pointages
 * Saisie d'un pointage pour un membre de l'équipe (upsert)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
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
      create: {
        profilRHId:    Number(profilRHId),
        date:          dateObj,
        statut:        calcul.statutAuto as StatutPointage,
        heureArrivee:  arrivee,
        heureDepart:   depart,
        notes:         notes        ?? null,
        justificatif:  justificatif ?? null,
        saisieParId:   parseInt(session.user.id),
        source:        "MANUEL",
        tempsTotal:    calcul.tempsTotal,
        retardMinutes: calcul.retardMinutes,
        heuresSup:     calcul.heuresSup,
      },
      update: {
        statut:        calcul.statutAuto as StatutPointage,
        heureArrivee:  arrivee,
        heureDepart:   depart,
        notes:         notes        ?? null,
        justificatif:  justificatif ?? null,
        tempsTotal:    calcul.tempsTotal,
        retardMinutes: calcul.retardMinutes,
        heuresSup:     calcul.heuresSup,
      },
    });

    return NextResponse.json({ data: pointage }, { status: 201 });
  } catch (error) {
    console.error("POST /api/responsableRH/pointages", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
