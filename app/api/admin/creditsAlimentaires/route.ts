import { NextResponse } from "next/server";
import { Prisma, StatutCreditAlim, SourceCreditAlim, PrioriteNotification, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/admin/creditsAlimentaires
 * Liste tous les credits alimentaires avec pagination, recherche et stats
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

    const statut =
      statutParam && Object.values(StatutCreditAlim).includes(statutParam as StatutCreditAlim)
        ? (statutParam as StatutCreditAlim)
        : undefined;

    const where: Prisma.CreditAlimentaireWhereInput = {
      ...(statut && { statut }),
      ...(search && {
        client: {
          OR: [
            { nom: { contains: search, mode: "insensitive" } },
            { prenom: { contains: search, mode: "insensitive" } },
            { telephone: { contains: search, mode: "insensitive" } },
          ],
        },
      }),
    };

    const [credits, total] = await Promise.all([
      prisma.creditAlimentaire.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              telephone: true,
            },
          },
        },
      }),
      prisma.creditAlimentaire.count({ where }),
    ]);

    // Statistiques
    const [totalActifs, totalEpuises, totalExpires, sumPlafond, sumUtilise] = await Promise.all([
      prisma.creditAlimentaire.count({ where: { statut: StatutCreditAlim.ACTIF } }),
      prisma.creditAlimentaire.count({ where: { statut: StatutCreditAlim.EPUISE } }),
      prisma.creditAlimentaire.count({ where: { statut: StatutCreditAlim.EXPIRE } }),
      prisma.creditAlimentaire.aggregate({
        _sum: { plafond: true },
      }),
      prisma.creditAlimentaire.aggregate({
        where: { statut: StatutCreditAlim.ACTIF },
        _sum: { montantUtilise: true, montantRestant: true },
      }),
    ]);

    return NextResponse.json({
      data: credits,
      stats: {
        totalActifs,
        totalEpuises,
        totalExpires,
        montantTotalPlafond: sumPlafond._sum.plafond ?? 0,
        montantTotalUtilise: sumUtilise._sum.montantUtilise ?? 0,
        montantTotalRestant: sumUtilise._sum.montantRestant ?? 0,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /admin/creditsAlimentaires error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des credits alimentaires" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/creditsAlimentaires
 * Creer un nouveau credit alimentaire pour un client
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const body = await req.json();
    const { clientId, plafond, source, sourceId, dateExpiration } = body;

    if (!clientId || !plafond || !source || !sourceId) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants (clientId, plafond, source, sourceId)" },
        { status: 400 }
      );
    }

    if (Number(plafond) <= 0) {
      return NextResponse.json(
        { error: "Le plafond doit etre superieur a 0" },
        { status: 400 }
      );
    }

    if (!Object.values(SourceCreditAlim).includes(source as SourceCreditAlim)) {
      return NextResponse.json(
        { error: "Source invalide (COTISATION ou TONTINE)" },
        { status: 400 }
      );
    }

    const client = await prisma.client.findUnique({ where: { id: Number(clientId) } });
    if (!client) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }

    const credit = await prisma.$transaction(async (tx) => {
      const created = await tx.creditAlimentaire.create({
        data: {
          clientId: Number(clientId),
          plafond: new Prisma.Decimal(plafond),
          montantUtilise: 0,
          montantRestant: new Prisma.Decimal(plafond),
          source: source as SourceCreditAlim,
          sourceId: Number(sourceId),
          dateExpiration: dateExpiration ? new Date(dateExpiration) : null,
        },
        include: {
          client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        },
      });

      // Notifier les admins
      const admins = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });

      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            titre: "Nouveau credit alimentaire",
            message: `Un credit alimentaire de ${plafond} FCFA a ete attribue a ${client.prenom} ${client.nom}.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/admin/creditsAlimentaires/${created.id}`,
          })),
        });
      }

      return created;
    });

    return NextResponse.json({ data: credit }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/creditsAlimentaires error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la creation du credit alimentaire" },
      { status: 500 }
    );
  }
}
