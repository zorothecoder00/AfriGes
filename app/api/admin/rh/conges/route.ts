import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutDemandeConge, TypeConge } from "@prisma/client";

/**
 * GET /api/admin/rh/conges
 * Liste toutes les demandes de congé avec filtres
 *
 * Query: statut, type, profilRHId, search, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut    = searchParams.get("statut")     as StatutDemandeConge | null;
    const type      = searchParams.get("type")       as TypeConge | null;
    const profilId  = searchParams.get("profilRHId");
    const search    = searchParams.get("search")?.trim() ?? "";
    const page      = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit     = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip      = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut)   where.statut     = statut;
    if (type)     where.type       = type;
    if (profilId) where.profilRHId = Number(profilId);
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

    const [demandes, total, stats] = await Promise.all([
      prisma.demandeConge.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          profilRH: {
            select: {
              id: true, matricule: true,
              gestionnaire: {
                select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } },
              },
            },
          },
        },
      }),
      prisma.demandeConge.count({ where }),
      // Stats par statut
      prisma.demandeConge.groupBy({
        by: ["statut"],
        _count: { id: true },
      }),
    ]);

    const statsMap = Object.fromEntries(stats.map((s) => [s.statut, s._count.id]));

    return NextResponse.json({
      data: demandes,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: statsMap,
    });
  } catch (error) {
    console.error("GET /api/admin/rh/conges", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/conges
 * L'admin crée une demande de congé pour un collaborateur
 * (équivalent à une demande déjà approuvée — statut APPROUVE directement)
 *
 * Body: { profilRHId, type, dateDebut, dateFin, nbJours, motif?, statut? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { profilRHId, type, dateDebut, dateFin, nbJours, motif, statut } = body;

    if (!profilRHId || !type || !dateDebut || !dateFin || !nbJours) {
      return NextResponse.json(
        { error: "profilRHId, type, dateDebut, dateFin et nbJours sont obligatoires" },
        { status: 400 }
      );
    }

    const profil = await prisma.profilRH.findUnique({ where: { id: Number(profilRHId) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    const finalStatut = (statut as StatutDemandeConge) ?? "EN_ATTENTE";
    const annee = new Date(dateDebut).getFullYear();

    const demande = await prisma.$transaction(async (tx) => {
      const d = await tx.demandeConge.create({
        data: {
          profilRHId:    Number(profilRHId),
          type:          type as TypeConge,
          dateDebut:     new Date(dateDebut),
          dateFin:       new Date(dateFin),
          nbJours:       Number(nbJours),
          motif:         motif ?? null,
          statut:        finalStatut,
          rhId:          finalStatut === "APPROUVE" ? parseInt(session.user.id) : null,
          dateDecisionFinale: finalStatut === "APPROUVE" ? new Date() : null,
        },
      });

      // Si approuvé directement → déduire du solde
      if (finalStatut === "APPROUVE") {
        await updateSolde(tx, Number(profilRHId), type as TypeConge, annee, Number(nbJours));
      }

      return d;
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "CREATE",
        entite:   "DemandeConge",
        entiteId: demande.id,
        details:  `Demande ${type} créée pour profilRH #${profilRHId} (${nbJours}j)`,
      },
    });

    return NextResponse.json({ data: demande }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/conges", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ── Helper : mise à jour solde ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateSolde(tx: any, profilRHId: number, type: TypeConge, annee: number, nbJours: number) {
  const politique = await tx.politiqueConge.findUnique({ where: { type } });
  const totalDroit = politique?.joursParAn ?? 0;

  await tx.soldeConge.upsert({
    where: { profilRHId_type_annee: { profilRHId, type, annee } },
    create: {
      profilRHId, type, annee,
      totalDroit,
      pris:    nbJours,
      restant: Math.max(0, totalDroit - nbJours),
    },
    update: {
      pris:    { increment: nbJours },
      restant: { decrement: nbJours },
    },
  });
}
