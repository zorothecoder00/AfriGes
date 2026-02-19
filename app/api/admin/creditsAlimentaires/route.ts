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
    const clientIdParam = searchParams.get("clientId");
    const filterClientId = clientIdParam && !isNaN(Number(clientIdParam)) ? Number(clientIdParam) : undefined;

    const statut =
      statutParam && Object.values(StatutCreditAlim).includes(statutParam as StatutCreditAlim)
        ? (statutParam as StatutCreditAlim)
        : undefined;

    const where: Prisma.CreditAlimentaireWhereInput = {
      ...(filterClientId && { clientId: filterClientId }),
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

    // ── Validation : la source doit exister et appartenir au client ─────────

    if (source === "COTISATION") {
      const cotisation = await prisma.cotisation.findUnique({
        where: { id: Number(sourceId) },
      });
      if (!cotisation) {
        return NextResponse.json({ error: "Cotisation introuvable" }, { status: 404 });
      }
      if (cotisation.clientId !== Number(clientId)) {
        return NextResponse.json(
          { error: `Cette cotisation appartient à un autre client. Impossible de l'associer à ${client.prenom} ${client.nom}.` },
          { status: 400 }
        );
      }
      if (cotisation.statut !== "PAYEE") {
        return NextResponse.json(
          {
            error:
              cotisation.statut === "EN_ATTENTE"
                ? "Cette cotisation n'a pas encore été payée. Un crédit ne peut être généré qu'à partir d'une cotisation payée."
                : "Cette cotisation est expirée. Elle ne peut plus générer de crédit alimentaire.",
          },
          { status: 400 }
        );
      }
    } else if (source === "TONTINE") {
      const tontine = await prisma.tontine.findUnique({
        where: { id: Number(sourceId) },
      });
      if (!tontine) {
        return NextResponse.json({ error: "Tontine introuvable" }, { status: 404 });
      }
      // La tontine doit être active
      if (tontine.statut !== "ACTIVE") {
        return NextResponse.json(
          { error: `Cette tontine n'est pas active (statut actuel : ${tontine.statut}). Seules les tontines actives peuvent générer un crédit.` },
          { status: 400 }
        );
      }
      // Le client doit être membre actif (non sorti)
      const membre = await prisma.tontineMembre.findFirst({
        where: { tontineId: Number(sourceId), clientId: Number(clientId), dateSortie: null },
      });
      if (!membre) {
        return NextResponse.json(
          { error: `${client.prenom} ${client.nom} n'est pas membre actif de cette tontine. Il ne peut pas recevoir un crédit lié à cette tontine.` },
          { status: 400 }
        );
      }
    }

    // ── Vérifier l'absence de doublon actif pour cette source précise ────────
    const creditExistant = await prisma.creditAlimentaire.findFirst({
      where: {
        clientId: Number(clientId),
        source: source as SourceCreditAlim,
        sourceId: Number(sourceId),
        statut: StatutCreditAlim.ACTIF,
      },
    });
    if (creditExistant) {
      const sourceLabel = source === "COTISATION" ? "cotisation" : "tontine";
      return NextResponse.json(
        {
          error: `Un crédit alimentaire actif existe déjà pour ce client sur cette ${sourceLabel} (crédit #${creditExistant.id}, solde restant : ${creditExistant.montantRestant} FCFA).`,
        },
        { status: 400 }
      );
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

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: parseInt(session.user.id),
          action: "CREATION_CREDIT_ALIMENTAIRE",
          entite: "CreditAlimentaire",
          entiteId: created.id,
        },
      });

      // Notifier les admins
      const admins = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });

      if (admins.length > 0) {
        const sourceLabel = source === "COTISATION" ? "cotisation" : "tontine";
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            titre: "Nouveau credit alimentaire",
            message: `Un crédit alimentaire de ${plafond} FCFA a été attribué à ${client.prenom} ${client.nom} (source : ${sourceLabel}).`,
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
