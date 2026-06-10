import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { StatutDemandeConge, TypeConge } from "@prisma/client";

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
 * GET /api/responsableRH/conges
 * Demandes de congé scoped à l'équipe du RH (PDV)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const pdvId   = await getPdvScope(session);
    const teamIds = await getTeamProfilIds(pdvId);

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut") as StatutDemandeConge | null;
    const type   = searchParams.get("type")   as TypeConge | null;
    const search = searchParams.get("search")?.trim() ?? "";
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip   = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut)   where.statut = statut;
    if (type)     where.type   = type;
    if (teamIds)  where.profilRHId = { in: teamIds };

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

    const scopeWhere = teamIds ? { profilRHId: { in: teamIds } } : {};

    const [demandes, total, stats] = await Promise.all([
      prisma.demandeConge.findMany({
        where,
        skip,
        take:     limit,
        orderBy:  { createdAt: "desc" },
        include: {
          profilRH: {
            select: {
              id: true, matricule: true,
              gestionnaire: { select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } } },
            },
          },
        },
      }),
      prisma.demandeConge.count({ where }),
      prisma.demandeConge.groupBy({ by: ["statut"], _count: { id: true }, where: scopeWhere }),
    ]);

    return NextResponse.json({
      data:  demandes,
      meta:  { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: Object.fromEntries(stats.map((s) => [s.statut, s._count.id])),
    });
  } catch (error) {
    console.error("GET /api/responsableRH/conges", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/responsableRH/conges
 * Crée une demande de congé pour un membre de l'équipe
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { profilRHId, type, dateDebut, dateFin, nbJours, motif } = body;

    if (!profilRHId || !type || !dateDebut || !dateFin || !nbJours) {
      return NextResponse.json(
        { error: "profilRHId, type, dateDebut, dateFin et nbJours sont obligatoires" },
        { status: 400 }
      );
    }

    const profil = await prisma.profilRH.findUnique({ where: { id: Number(profilRHId) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    const demande = await prisma.demandeConge.create({
      data: {
        profilRHId: Number(profilRHId),
        type:       type as TypeConge,
        dateDebut:  new Date(dateDebut),
        dateFin:    new Date(dateFin),
        nbJours:    Number(nbJours),
        motif:      motif ?? null,
        statut:     "EN_ATTENTE",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "CREATE",
        entite:   "DemandeConge",
        entiteId: demande.id,
        details:  `Demande ${type} créée par RH pour profilRH #${profilRHId} (${nbJours}j)`,
      },
    });

    return NextResponse.json({ data: demande }, { status: 201 });
  } catch (error) {
    console.error("POST /api/responsableRH/conges", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
