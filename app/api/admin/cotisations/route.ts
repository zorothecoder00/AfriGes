import { NextResponse } from "next/server";
import { Prisma, StatutCotisation, PeriodeCotisation, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/admin/cotisations
 * Liste toutes les cotisations avec pagination, recherche et filtres
 */
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 10)));
    const skip = (page - 1) * limit;

    const search = searchParams.get("search") || "";
    const statutParam = searchParams.get("statut");
    const periodeParam = searchParams.get("periode");

    const statut =
      statutParam && Object.values(StatutCotisation).includes(statutParam as StatutCotisation)
        ? (statutParam as StatutCotisation)
        : undefined;

    const periode =
      periodeParam && Object.values(PeriodeCotisation).includes(periodeParam as PeriodeCotisation)
        ? (periodeParam as PeriodeCotisation)
        : undefined;

    const where: Prisma.CotisationWhereInput = {
      ...(statut && { statut }),
      ...(periode && { periode }),
      ...(search && {
        member: {
          OR: [
            { nom: { contains: search, mode: "insensitive" } },
            { prenom: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        },
      }),
    };

    const [cotisations, total] = await Promise.all([
      prisma.cotisation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          member: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
            },
          },
        },
      }),
      prisma.cotisation.count({ where }),
    ]);

    // Statistiques agregees
    const [totalPayees, totalEnAttente, totalExpirees, sumPayees] = await Promise.all([
      prisma.cotisation.count({ where: { statut: StatutCotisation.PAYEE } }),
      prisma.cotisation.count({ where: { statut: StatutCotisation.EN_ATTENTE } }),
      prisma.cotisation.count({ where: { statut: StatutCotisation.EXPIREE } }),
      prisma.cotisation.aggregate({
        where: { statut: StatutCotisation.PAYEE },
        _sum: { montant: true },
      }),
    ]);

    return NextResponse.json({
      data: cotisations,
      stats: {
        totalPayees,
        totalEnAttente,
        totalExpirees,
        montantTotalCollecte: sumPayees._sum.montant ?? 0,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /admin/cotisations error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des cotisations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cotisations
 * Enregistrer un paiement de cotisation
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const body = await req.json();
    const { memberId, montant, periode, dateEcheance } = body;

    if (!memberId || !montant || !periode || !dateEcheance) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants (memberId, montant, periode, dateEcheance)" },
        { status: 400 }
      );
    }

    if (Number(montant) <= 0) {
      return NextResponse.json(
        { error: "Le montant doit etre superieur a 0" },
        { status: 400 }
      );
    }

    if (!Object.values(PeriodeCotisation).includes(periode as PeriodeCotisation)) {
      return NextResponse.json(
        { error: "Periode invalide (MENSUEL ou ANNUEL)" },
        { status: 400 }
      );
    }

    const member = await prisma.user.findUnique({ where: { id: Number(memberId) } });
    if (!member) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    const cotisation = await prisma.$transaction(async (tx) => {
      const created = await tx.cotisation.create({
        data: {
          memberId: Number(memberId),
          montant: new Prisma.Decimal(montant),
          periode: periode as PeriodeCotisation,
          dateExpiration: new Date(dateEcheance),
          statut: StatutCotisation.PAYEE,
          datePaiement: new Date(),
        },
        include: {
          member: { select: { id: true, nom: true, prenom: true, email: true } },
        },
      });

      await tx.notification.create({
        data: {
          userId: Number(memberId),
          titre: "Cotisation enregistree",
          message: `Votre cotisation de ${montant} EUR a ete enregistree.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/cotisations`,
        },
      });

      return created;
    });

    return NextResponse.json({ data: cotisation }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/cotisations error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement de la cotisation" },
      { status: 500 }
    );
  }
}
