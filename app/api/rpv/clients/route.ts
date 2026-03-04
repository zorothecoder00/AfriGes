import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { auditLog } from "@/lib/notifications";

/**
 * GET /api/rpv/clients
 * Liste paginée des clients du point de vente.
 * Query: search, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Number(searchParams.get("limit") || 15));
    const skip   = (page - 1) * limit;
    const search = searchParams.get("search") || "";

    const where: Prisma.ClientWhereInput = search
      ? {
          OR: [
            { nom:       { contains: search, mode: "insensitive" } },
            { prenom:    { contains: search, mode: "insensitive" } },
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
          _count: { select: { souscriptionsPacks: true } },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: clients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/rpv/clients", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/rpv/clients
 * Crée un nouveau client.
 * Body: { nom, prenom, telephone, adresse? }
 */
export async function POST(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { nom, prenom, telephone, adresse } = await req.json();

    if (!nom || !prenom || !telephone) {
      return NextResponse.json({ error: "nom, prenom et telephone sont obligatoires" }, { status: 400 });
    }

    // Vérifier doublon téléphone
    const existing = await prisma.client.findUnique({ where: { telephone } });
    if (existing) {
      return NextResponse.json({ error: "Un client avec ce numéro existe déjà" }, { status: 409 });
    }

    const client = await prisma.$transaction(async (tx) => {
      const c = await tx.client.create({
        data: { nom, prenom, telephone, adresse: adresse || null },
      });
      await auditLog(tx, parseInt(session.user.id), "CLIENT_CREE", "Client", c.id);
      return c;
    });

    return NextResponse.json({ success: true, data: client }, { status: 201 });
  } catch (error) {
    console.error("POST /api/rpv/clients", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
