import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { StatutPoste } from "@prisma/client";

async function getPdvId(session: Awaited<ReturnType<typeof getRHSession>>) {
  const isAdmin = session!.user.role === "ADMIN" || session!.user.role === "SUPER_ADMIN";
  if (isAdmin) return null;
  const aff = await prisma.gestionnaireAffectation.findFirst({
    where:  { userId: parseInt(session!.user.id), actif: true },
    select: { pointDeVenteId: true },
  });
  return aff?.pointDeVenteId ?? null;
}

/**
 * GET /api/responsableRH/recrutement/postes
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const pdvId = await getPdvId(session);

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut") as StatutPoste | null;
    const search = searchParams.get("search")?.trim() ?? "";
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip   = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut         = statut;
    if (search) {
      where.OR = [
        { titre:       { contains: search, mode: "insensitive" } },
        { departement: { contains: search, mode: "insensitive" } },
        { reference:   { contains: search, mode: "insensitive" } },
      ];
    }

    const [postes, total] = await Promise.all([
      prisma.posteOuvert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          candidatures: {
            orderBy: { dateCandidature: "desc" },
            select: {
              id: true, nomCandidat: true, prenomCandidat: true, email: true,
              statut: true, scoreCandidat: true, noteEntretien: true,
              dateEntretien: true, dateTest: true, sourceCandidat: true,
              createdAt: true,
            },
          },
          _count: { select: { candidatures: true } },
        },
      }),
      prisma.posteOuvert.count({ where }),
    ]);

    const stats = await prisma.posteOuvert.groupBy({
      by:    ["statut"],
      where: {},
      _count: { id: true },
    });

    return NextResponse.json({
      data: postes,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: Object.fromEntries(stats.map((s) => [s.statut, s._count.id])),
    });
  } catch (error) {
    console.error("GET /api/responsableRH/recrutement/postes", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/responsableRH/recrutement/postes
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const pdvId = await getPdvId(session);
    const body  = await req.json();

    if (!body.titre) return NextResponse.json({ error: "Le titre est obligatoire" }, { status: 400 });

    const year  = new Date().getFullYear();
    const count = await prisma.posteOuvert.count();
    const reference = `REC-${year}-${String(count + 1).padStart(4, "0")}`;

    const poste = await prisma.posteOuvert.create({
      data: {
        reference,
        titre:           body.titre,
        departement:     body.departement     ?? null,
        service:         body.service         ?? null,
        lieu:            body.lieu            ?? null,
        typeContrat:     body.typeContrat      ?? null,
        description:     body.description     ?? null,
        exigences:       body.exigences        ?? null,
        experienceMin:   body.experienceMin    ? Number(body.experienceMin) : null,
        nbPostes:        body.nbPostes         ? Number(body.nbPostes) : 1,
        salaireMini:     body.salaireMini      ? Number(body.salaireMini) : null,
        salaireMaxi:     body.salaireMaxi      ? Number(body.salaireMaxi) : null,
        budgetPoste:     body.budgetPoste      ? Number(body.budgetPoste) : null,
        dateLimite:      body.dateLimite       ? new Date(body.dateLimite) : null,
        notes:           body.notes            ?? null,
        statut:          "BROUILLON",
        createdById:     parseInt(session.user.id),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "CREATE",
        entite:   "PosteOuvert",
        entiteId: poste.id,
        details:  `Poste créé par RH — ${reference} : ${body.titre}`,
      },
    });

    return NextResponse.json({ data: poste }, { status: 201 });
  } catch (error) {
    console.error("POST /api/responsableRH/recrutement/postes", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
