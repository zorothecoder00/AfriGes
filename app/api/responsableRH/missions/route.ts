import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { StatutMission } from "@prisma/client";

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
 * GET /api/responsableRH/missions
 * Missions de l'équipe du RH (scoped PDV)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const pdvId   = await getPdvScope(session);
    const teamIds = await getTeamProfilIds(pdvId);

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut") as StatutMission | null;
    const search = searchParams.get("search")?.trim() ?? "";
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip   = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut)  where.statut          = statut;
    if (teamIds) where.collaborateurId = { in: teamIds };

    if (search) {
      where.OR = [
        { titre:       { contains: search, mode: "insensitive" } },
        { destination: { contains: search, mode: "insensitive" } },
        { reference:   { contains: search, mode: "insensitive" } },
        {
          collaborateur: {
            gestionnaire: { member: { OR: [
              { nom:    { contains: search, mode: "insensitive" } },
              { prenom: { contains: search, mode: "insensitive" } },
            ]}},
          },
        },
      ];
    }

    const scopeWhere = teamIds ? { collaborateurId: { in: teamIds } } : {};

    const [missions, total, stats] = await Promise.all([
      prisma.mission.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { dateDepart: "desc" },
        include: {
          collaborateur: {
            select: {
              id: true, matricule: true,
              gestionnaire: { select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } } },
            },
          },
          validePar: {
            select: {
              id: true, matricule: true,
              gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
            },
          },
        },
      }),
      prisma.mission.count({ where }),
      prisma.mission.groupBy({ by: ["statut"], _count: { id: true }, where: scopeWhere }),
    ]);

    return NextResponse.json({
      data:  missions,
      meta:  { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: Object.fromEntries(stats.map((s) => [s.statut, s._count.id])),
    });
  } catch (error) {
    console.error("GET /api/responsableRH/missions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/responsableRH/missions
 * Créer une mission pour un membre de l'équipe
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { collaborateurId, titre, objectifs, livrables, destination, dateDepart, dateRetour, notes } = body;

    if (!collaborateurId || !titre || !dateDepart) {
      return NextResponse.json(
        { error: "collaborateurId, titre et dateDepart sont obligatoires" },
        { status: 400 }
      );
    }

    const profil = await prisma.profilRH.findUnique({ where: { id: Number(collaborateurId) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    const annee     = new Date(dateDepart).getFullYear();
    const count     = await prisma.mission.count();
    const reference = `MSN-${annee}-${String(count + 1).padStart(4, "0")}`;

    const mission = await prisma.mission.create({
      data: {
        reference,
        collaborateurId: Number(collaborateurId),
        titre,
        objectifs:   objectifs   ?? null,
        livrables:   livrables   ?? null,
        destination: destination ?? null,
        dateDepart:  new Date(dateDepart),
        dateRetour:  dateRetour ? new Date(dateRetour) : null,
        notes:       notes       ?? null,
        statut:      "CREE",
      },
      include: {
        collaborateur: {
          select: {
            id: true, matricule: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "CREATE",
        entite:   "Mission",
        entiteId: mission.id,
        details:  `Mission ${reference} créée par RH pour profilRH #${collaborateurId}`,
      },
    });

    return NextResponse.json({ data: mission }, { status: 201 });
  } catch (error) {
    console.error("POST /api/responsableRH/missions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
