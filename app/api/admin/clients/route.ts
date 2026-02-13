import { NextResponse } from "next/server";
import { MemberStatus, PrioriteNotification, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * ==========================
 * GET /api/admin/clients
 * ==========================
 * Lister tous les clients (paginé, avec recherche)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 10);
    const skip = (page - 1) * limit;
    const search = searchParams.get("search") || "";

    const where: Prisma.ClientWhereInput = {
      ...(search && {
        OR: [
          { nom: { contains: search, mode: "insensitive" } },
          { prenom: { contains: search, mode: "insensitive" } },
          { telephone: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              credits: true,
              creditsAlim: true,
              cotisations: true,
              tontines: true,
            },
          },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return NextResponse.json({
      data: clients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur lors de la récupération des clients" },
      { status: 500 }
    );
  }
}

/**
 * ==========================
 * POST /api/admin/clients
 * ==========================
 * Créer un nouveau client
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nom, prenom, telephone, adresse } = body;

    if (!nom || !prenom || !telephone) {
      return NextResponse.json(
        { message: "Champs obligatoires manquants (nom, prénom, téléphone)" },
        { status: 400 }
      );
    }

    // Vérifier doublon sur téléphone
    const existing = await prisma.client.findUnique({
      where: { telephone },
    });

    if (existing) {
      return NextResponse.json(
        { message: "Ce numéro de téléphone est déjà utilisé" },
        { status: 409 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Création du client
      const client = await tx.client.create({
        data: {
          nom,
          prenom,
          telephone,
          adresse: adresse || null,
          etat: MemberStatus.ACTIF,
        },
      });

      // 2. Audit log
      await tx.auditLog.create({
        data: {
          action: "CREATION_CLIENT",
          entite: "Client",
          entiteId: client.id,
        },
      });

      // 3. Notifications aux admins
      const destinataires = await tx.user.findMany({
        where: {
          role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
        },
        select: { id: true },
      });

      if (destinataires.length > 0) {
        await tx.notification.createMany({
          data: destinataires.map((user) => ({
            userId: user.id,
            titre: "Nouveau client ajouté",
            message: `Un nouveau client (${prenom} ${nom}) a été ajouté.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/admin/clients`,
          })),
        });
      }

      return client;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur lors de la création du client" },
      { status: 500 }
    );
  }
}
