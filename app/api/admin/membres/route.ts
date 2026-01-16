import { NextResponse } from "next/server";
import { Role, MemberStatus, PrioriteNotification, Prisma } from "@prisma/client";
import { prisma } from '@/lib/prisma'
import bcrypt from "bcryptjs";


/**
 * ========================== 
 * GET /admin/membres   
 * ==========================
 * Lister tous les membres
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // -------------------------
    // Pagination
    // -------------------------
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 10);
    const skip = (page - 1) * limit;

    // -------------------------
    // Recherche
    // -------------------------
    const search = searchParams.get("search") || "";

    // -------------------------
    // Filtre rôle
    // -------------------------
    const roleParam = searchParams.get("role");
    const role =
      roleParam && Object.values(Role).includes(roleParam as Role)
        ? (roleParam as Role)
        : undefined;

    // -------------------------
    // Tri
    // -------------------------
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const allowedFields = ['nom', 'prenom', 'email', 'createdAt'];  // sécurisation
    const field = allowedFields.includes(sortBy as string)
        ? sortBy
        : 'createdAt'    
    const safeField = field as string
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";

    // -------------------------
    // Construction du WHERE
    // -------------------------
    const where: Prisma.UserWhereInput = {
      ...(role && { role }),
      ...(search && {
        OR: [
          { nom: { contains: search, mode: "insensitive" } },
          { prenom: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }), 
    };

    // -------------------------
    // Requête Prisma
    // -------------------------
    const [members, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [safeField]: order,
        },
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
          role: true,
          photo: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      data: members,
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
      { message: "Erreur lors de la récupération des membres" },
      { status: 500 }
    );
  }
}

/**
 * ==========================
 * POST /admin/membres
 * ==========================
 * Créer un nouveau membre
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nom, prenom, email, password, telephone, adresse } = body;

    if (!nom || !prenom || !email || !password) {
      return NextResponse.json(
        { message: "Champs obligatoires manquants" },
        { status: 400 }
      );
    }

    // Vérifier si email existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Email déjà utilisé" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Création du membre
      const membre = await tx.user.create({
        data: {
          nom,
          prenom,
          email,
          telephone,
          adresse,
          role: Role.USER,
          etat: MemberStatus.ACTIF,
          passwordHash,

          wallet: {
            create: {},
          },

          auditLogs: {
            create: {
              action: "CREATION_MEMBRE",
              entite: "User",
            },
          },
        },
      });

      // 2. Récupérer les ADMIN & SUPER_ADMIN uniquement
      const destinataires = await tx.user.findMany({
        where: {
          role: {
            in: [Role.ADMIN, Role.SUPER_ADMIN],
          },
        },
        select: {
          id: true,
        },
      });

      // 3. Créer les notifications
      if (destinataires.length > 0) {
        await tx.notification.createMany({
          data: destinataires.map((user) => ({
            userId: user.id,
            titre: "Nouveau membre créé",
            message: `Un nouveau membre (${membre.prenom} ${membre.nom}) a été ajouté.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/admin/membres/${membre.id}`,
          })),
        });
      }

      return membre;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur lors de la création du membre" },
      { status: 500 }
    );
  }
}

