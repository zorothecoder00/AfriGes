import { NextResponse } from "next/server";
import {Prisma, Role, RoleGestionnaire, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * ==========================
 * GET /admin/gestionnaires
 * ==========================
 * Lister les gestionnaires
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Pagination
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 10);
    const skip = (page - 1) * limit;

    // Filtres
    const roleParam = searchParams.get("role");
    const actifParam = searchParams.get("actif");

    const role =
      roleParam &&
      Object.values(RoleGestionnaire).includes(roleParam as RoleGestionnaire)
        ? (roleParam as RoleGestionnaire)
        : undefined;

    const actif =
      actifParam === "true"
        ? true
        : actifParam === "false"
        ? false
        : undefined;

    const where: Prisma.GestionnaireWhereInput = {
      ...(role && { role }),
      ...(actif !== undefined && { actif }),
    };

    const [gestionnaires, total] = await Promise.all([
      prisma.gestionnaire.findMany({
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
              telephone: true,
            },
          },
        },
      }),
      prisma.gestionnaire.count({ where }),
    ]);

    return NextResponse.json({
      data: gestionnaires,
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
      { message: "Erreur lors de la récupération des gestionnaires" },
      { status: 500 }
    );
  }
}

/**
 * ==========================
 * POST /admin/gestionnaires
 * ==========================
 * Créer un gestionnaire
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { memberId, role } = body;

    if (!memberId || !role) {
      return NextResponse.json(
        { message: "memberId et role sont obligatoires" },
        { status: 400 }
      );
    }

    if (!Object.values(RoleGestionnaire).includes(role)) {
      return NextResponse.json(
        { message: "Rôle de gestionnaire invalide" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Vérifier que l'utilisateur existe
      const user = await tx.user.findUnique({
        where: { id: memberId },
        include: { gestionnaire: true },
      });

      if (!user) {
        throw new Error("Utilisateur introuvable");
      }

      if (user.gestionnaire) {
        throw new Error("Cet utilisateur est déjà gestionnaire");
      }

      // Création du gestionnaire
      const gestionnaire = await tx.gestionnaire.create({
        data: {
          memberId,
          role,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: memberId,
          action: "CREATION_GESTIONNAIRE",
          entite: "Gestionnaire",
          entiteId: gestionnaire.id,
        },
      });

      // Notification ADMIN & SUPER_ADMIN
      const admins = await tx.user.findMany({
        where: {
          role: {
            in: [Role.ADMIN, Role.SUPER_ADMIN],
          },
        },
        select: { id: true },
      });

      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            titre: "Nouveau gestionnaire",
            message: `${user.prenom} ${user.nom} a été nommé gestionnaire (${role}).`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/admin/gestionnaires`,
          })),
        });
      }

      return gestionnaire;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: unknown) {
    console.error(error);

    if(error instanceof Error){
      if (
      error.message === "Utilisateur introuvable" ||
      error.message === "Cet utilisateur est déjà gestionnaire"
      ) {
        return NextResponse.json(
          { message: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { message: "Erreur lors de la création du gestionnaire" },
      { status: 500 }
    );
  }
}
