import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutEvaluationRH, PeriodeEvaluation, TypeEvaluation } from "@prisma/client";

/**
 * GET /api/admin/rh/evaluations
 * Query: profilRHId, annee, statut, periode, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const profilRHId = searchParams.get("profilRHId");
    const annee      = searchParams.get("annee");
    const statut     = searchParams.get("statut")  as StatutEvaluationRH | null;
    const periode    = searchParams.get("periode") as PeriodeEvaluation  | null;
    const type       = searchParams.get("type")    as TypeEvaluation     | null;
    const search     = searchParams.get("search")?.trim() ?? "";
    const page       = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit      = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip       = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (profilRHId) where.profilRHId    = Number(profilRHId);
    if (annee)      where.annee         = Number(annee);
    if (statut)     where.statut        = statut;
    if (periode)    where.periode       = periode;
    if (type)       where.typeEvaluation = type;
    if (search) {
      where.profilRH = {
        gestionnaire: { member: { OR: [
          { nom:    { contains: search, mode: "insensitive" } },
          { prenom: { contains: search, mode: "insensitive" } },
        ]}},
      };
    }

    const INCLUDE = {
      criteres:  true,
      objectifs: { where: { actif: true } },
      profilRH: {
        select: {
          id: true, matricule: true,
          gestionnaire: { select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } } },
        },
      },
      evaluateur: {
        select: {
          id: true, matricule: true,
          gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
        },
      },
    };

    const [evaluations, total, statsByStatut, statsByType] = await Promise.all([
      prisma.evaluationRH.findMany({ where, skip, take: limit, orderBy: [{ annee: "desc" }, { createdAt: "desc" }], include: INCLUDE }),
      prisma.evaluationRH.count({ where }),
      prisma.evaluationRH.groupBy({ by: ["statut"],         _count: { id: true } }),
      prisma.evaluationRH.groupBy({ by: ["typeEvaluation"], _count: { id: true } }),
    ]);

    const statsStatut = Object.fromEntries(statsByStatut.map((s) => [s.statut, s._count.id]));
    const statsType   = Object.fromEntries(statsByType.map((s) => [String(s.typeEvaluation), s._count.id]));
    return NextResponse.json({
      data: evaluations,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: statsStatut,
      statsByType: statsType,
    });
  } catch (error) {
    console.error("GET /api/admin/rh/evaluations", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/evaluations
 * Body: { profilRHId, evaluateurId?, periode, annee, dateDebut, dateFin?, criteres?: [{libelle, note, commentaire?}], ... }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const {
      profilRHId, evaluateurId, typeEvaluation, periode, annee, dateDebut, dateFin,
      noteGlobale, appreciation, pointsForts, axesAmelioration, objectifsN1, notes,
      criteres = [],
    } = body;

    if (!profilRHId || !periode || !annee || !dateDebut) {
      return NextResponse.json({ error: "profilRHId, periode, annee et dateDebut sont obligatoires" }, { status: 400 });
    }

    const evaluation = await prisma.evaluationRH.create({
      data: {
        profilRHId:       Number(profilRHId),
        evaluateurId:     evaluateurId   ? Number(evaluateurId) : null,
        typeEvaluation:   typeEvaluation ? typeEvaluation as TypeEvaluation : null,
        periode:          periode as PeriodeEvaluation,
        annee:            Number(annee),
        dateDebut:        new Date(dateDebut),
        dateFin:          dateFin       ? new Date(dateFin) : null,
        noteGlobale:      noteGlobale   ? Number(noteGlobale) : null,
        appreciation:     appreciation  ?? null,
        pointsForts:      pointsForts   ?? null,
        axesAmelioration: axesAmelioration ?? null,
        objectifsN1:      objectifsN1   ?? null,
        notes:            notes         ?? null,
        statut:           "BROUILLON",
        criteres: criteres.length > 0 ? {
          create: criteres.map((c: { libelle: string; note: number; commentaire?: string }) => ({
            libelle:     c.libelle,
            note:        Number(c.note),
            commentaire: c.commentaire ?? null,
          })),
        } : undefined,
      },
      include: { criteres: true },
    });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "CREATE", entite: "EvaluationRH", entiteId: evaluation.id, details: `Évaluation ${periode} ${annee} créée pour profilRH #${profilRHId}` },
    });

    return NextResponse.json({ data: evaluation }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/evaluations", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
