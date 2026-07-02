import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutFichePaie } from "@prisma/client";
import { creerFichePaie, FichePaieError } from "@/lib/creerFichePaie";

/**
 * GET /api/admin/rh/paie
 * Liste les fiches de paie
 * Query: profilRHId, mois, annee, statut, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const profilRHId = searchParams.get("profilRHId");
    const mois       = searchParams.get("mois");
    const annee      = searchParams.get("annee");
    const statut     = searchParams.get("statut") as StatutFichePaie | null;
    const search     = searchParams.get("search")?.trim() ?? "";
    const page       = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit      = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip       = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (profilRHId) where.profilRHId = Number(profilRHId);
    if (mois)   where.mois   = Number(mois);
    if (annee)  where.annee  = Number(annee);
    if (statut) where.statut = statut;
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

    const [fiches, total, stats] = await Promise.all([
      prisma.fichePaie.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ annee: "desc" }, { mois: "desc" }],
        include: {
          profilRH: {
            select: {
              id: true, matricule: true,
              gestionnaire: { select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } } },
            },
          },
          composants: true,
        },
      }),
      prisma.fichePaie.count({ where }),
      prisma.fichePaie.groupBy({ by: ["statut"], _count: { id: true } }),
    ]);

    const statsMap = Object.fromEntries(stats.map((s) => [s.statut, s._count.id]));
    return NextResponse.json({
      data: fiches,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: statsMap,
    });
  } catch (error) {
    console.error("GET /api/admin/rh/paie", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/paie
 * Crée une fiche de paie avec ses composants
 * Body: { profilRHId, mois, annee, salaireBase, composants: [{type, libelle, montant, isRetenue}], notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { profilRHId, mois, annee, salaireBase, composants = [], notes } = body;

    if (!profilRHId || !mois || !annee) {
      return NextResponse.json({ error: "profilRHId, mois et annee sont obligatoires" }, { status: 400 });
    }

    // Autos activés par défaut (CDC 13.2/13.4/13.5/13.6 + prime d'ancienneté).
    const fiche = await creerFichePaie({
      profilRHId:      Number(profilRHId),
      mois:            Number(mois),
      annee:           Number(annee),
      salaireBase:     Number(salaireBase ?? 0),
      composants,
      notes:           notes ?? null,
      genereParId:     parseInt(session.user.id),
      autoRetenues:    body.autoRetenues    !== false,
      autoCommissions: body.autoCommissions !== false,
      autoDeductions:  body.autoDeductions  !== false,
      autoAnciennete:  body.autoAnciennete  !== false,
    });

    return NextResponse.json({ data: fiche }, { status: 201 });
  } catch (error) {
    if (error instanceof FichePaieError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/admin/rh/paie", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
