import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";

/**
 * GET /api/agentTerrain/clients
 * Liste clients avec pagination et recherche
 */
export async function GET(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 10)));
    const skip = (page - 1) * limit;
    const search = searchParams.get("search") || "";

    const where: Prisma.ClientWhereInput = search
      ? {
          OR: [
            { nom: { contains: search, mode: "insensitive" } },
            { prenom: { contains: search, mode: "insensitive" } },
            { telephone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { credits: true, creditsAlim: true, cotisations: true, tontines: true },
          },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return NextResponse.json({
      data: clients,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /agentTerrain/clients error:", error);
    return NextResponse.json({ error: "Erreur lors du chargement des clients" }, { status: 500 });
  }
}

/**
 * POST /api/agentTerrain/clients
 * Créer un nouveau client (prospection terrain)
 */
export async function POST(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const body = await req.json();
    const { nom, prenom, telephone, adresse } = body;

    if (!nom || !prenom || !telephone) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants (nom, prenom, telephone)" },
        { status: 400 }
      );
    }

    const existing = await prisma.client.findUnique({ where: { telephone } });
    if (existing) {
      return NextResponse.json({ error: "Ce numero de telephone est deja utilise" }, { status: 400 });
    }

    const client = await prisma.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: { nom, prenom, telephone, adresse: adresse || null },
      });

      await tx.auditLog.create({
        data: {
          userId: parseInt(session.user.id),
          action: "CREATION_CLIENT_PROSPECTION",
          entite: "Client",
          entiteId: created.id,
        },
      });

      const admins = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });

      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            titre: "Nouveau client (prospection)",
            message: `L'agent terrain ${session.user.prenom} ${session.user.nom} a ajoute le client ${prenom} ${nom} (${telephone}).`,
            priorite: PrioriteNotification.NORMAL,
          })),
        });
      }

      return created;
    });

    return NextResponse.json({ data: client }, { status: 201 });
  } catch (error) {
    console.error("POST /agentTerrain/clients error:", error);
    return NextResponse.json({ error: "Erreur lors de la creation du client" }, { status: 500 });
  }
}
