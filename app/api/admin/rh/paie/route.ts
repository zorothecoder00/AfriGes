import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutFichePaie } from "@prisma/client";

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

    const profil = await prisma.profilRH.findUnique({ where: { id: Number(profilRHId) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    // Calculer totaux depuis les composants
    const totalBrut     = composants.filter((c: { isRetenue: boolean; montant: number }) => !c.isRetenue).reduce((s: number, c: { montant: number }) => s + Number(c.montant), Number(salaireBase ?? 0));
    const totalRetenues = composants.filter((c: { isRetenue: boolean; montant: number }) =>  c.isRetenue).reduce((s: number, c: { montant: number }) => s + Number(c.montant), 0);
    const netAPayer     = totalBrut - totalRetenues;

    const fiche = await prisma.$transaction(async (tx) => {
      const f = await tx.fichePaie.create({
        data: {
          profilRHId:    Number(profilRHId),
          mois:          Number(mois),
          annee:         Number(annee),
          salaireBase:   Number(salaireBase ?? 0),
          totalBrut,
          totalRetenues,
          netAPayer,
          notes:         notes ?? null,
          genereParId:   parseInt(session.user.id),
          statut:        "BROUILLON",
          composants: {
            create: composants.map((c: { type: string; libelle: string; montant: number; isRetenue: boolean }) => ({
              type:      c.type,
              libelle:   c.libelle,
              montant:   Number(c.montant),
              isRetenue: c.isRetenue ?? false,
            })),
          },
        },
        include: { composants: true },
      });
      return f;
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "CREATE",
        entite:   "FichePaie",
        entiteId: fiche.id,
        details:  `Fiche paie ${mois}/${annee} créée pour profilRH #${profilRHId}`,
      },
    });

    return NextResponse.json({ data: fiche }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/paie", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
