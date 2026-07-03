import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { getRHScope, profilDansPerimetre } from "@/lib/scopeRH";

/**
 * GET  /api/responsableRH/paie/avances
 *   Query: profilRHId?, statut?, page?, limit?
 *   Scopé au PDV du RESPONSABLE_RH (admin = tout).
 *
 * POST /api/responsableRH/paie/avances
 *   Body: { profilRHId, montant, motif?, echeancesMois? }
 *   Crée une demande d'avance (statut EN_ATTENTE) — collaborateur du PDV uniquement.
 */

export async function GET(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const scope = await getRHScope(session);

    const { searchParams } = req.nextUrl;
    const profilRHId = searchParams.get("profilRHId");
    const statut     = searchParams.get("statut") ?? undefined;
    const page       = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit      = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const skip       = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (scope.profilRHIds !== null) where.profilRHId = { in: scope.profilRHIds };
    if (profilRHId) {
      const asked = Number(profilRHId);
      if (!profilDansPerimetre(scope, asked)) {
        return NextResponse.json({ error: "Collaborateur hors de votre périmètre" }, { status: 403 });
      }
      where.profilRHId = asked;
    }
    if (statut) where.statut = statut;

    const [avances, total] = await Promise.all([
      prisma.avanceSalaire.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          profilRH: {
            select: {
              id: true, matricule: true,
              gestionnaire: { select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } } },
            },
          },
        },
      }),
      prisma.avanceSalaire.count({ where }),
    ]);

    return NextResponse.json({
      data: avances,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/responsableRH/paie/avances", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const scope = await getRHScope(session);
    const { profilRHId, montant, motif, echeancesMois } = await req.json();

    if (!profilRHId || !montant) {
      return NextResponse.json({ error: "profilRHId et montant sont obligatoires" }, { status: 400 });
    }

    if (!profilDansPerimetre(scope, Number(profilRHId))) {
      return NextResponse.json({ error: "Collaborateur hors de votre périmètre" }, { status: 403 });
    }

    const profil = await prisma.profilRH.findUnique({ where: { id: Number(profilRHId) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    const avance = await prisma.avanceSalaire.create({
      data: {
        profilRHId:     Number(profilRHId),
        montant:        Number(montant),
        motif:          motif ?? null,
        echeancesMois:  echeancesMois ? Number(echeancesMois) : 1,
        montantRestant: Number(montant),
        statut:         "EN_ATTENTE",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "CREATE",
        entite:   "AvanceSalaire",
        entiteId: avance.id,
        details:  { apres: { montant: avance.montant, profilRHId: avance.profilRHId } },
      },
    });

    return NextResponse.json({ data: avance }, { status: 201 });
  } catch (error) {
    console.error("POST /api/responsableRH/paie/avances", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
