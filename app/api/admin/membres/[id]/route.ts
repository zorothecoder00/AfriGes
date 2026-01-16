import { NextResponse } from "next/server";
import {
  Role,
  MemberStatus,
  PrioriteNotification,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * ==========================
 * GET /admin/membres/[id]
 * ==========================
 * Lire un membre spécifique
 */
export async function GET(
  _req: Request,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const memberId = Number(id);

    if (isNaN(memberId)) {
      return NextResponse.json(
        { message: "ID invalide" },
        { status: 400 }
      );
    }

    const membre = await prisma.user.findUnique({
      where: { id: memberId },
      include: {
        wallet: true,
        gestionnaire: true,
      },
    });

    if (!membre) {
      return NextResponse.json(
        { message: "Membre introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: membre });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur lors de la récupération du membre" },
      { status: 500 }
    );
  }
}

/**
 * ==========================
 * PATCH /admin/membres/[id]
 * ==========================
 * Modifier un membre
 */
export async function PATCH(
  req: Request,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const memberId = Number(id);

    if (isNaN(memberId)) {
      return NextResponse.json(
        { message: "ID invalide" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      nom,
      prenom,
      email,
      telephone,
      adresse,
      role,
      etat,
      password,
    } = body;

    if (
      role &&
      !Object.values(Role).includes(role)
    ) {
      return NextResponse.json(
        { message: "Rôle invalide" },
        { status: 400 }
      );
    }

    if (
      etat &&
      !Object.values(MemberStatus).includes(etat)
    ) {
      return NextResponse.json(
        { message: "État invalide" },
        { status: 400 }
      );
    }

    const passwordHash = password
      ? await bcrypt.hash(password, 10)
      : undefined;

    const result = await prisma.$transaction(async (tx) => {
      const membre = await tx.user.findUnique({
        where: { id: memberId },
      });

      if (!membre) {
        throw new Error("MEMBRE_INTRouvable");
      }

      const updated = await tx.user.update({
        where: { id: memberId },
        data: {
          ...(nom && { nom }),
          ...(prenom && { prenom }),
          ...(email && { email }),
          ...(telephone && { telephone }),
          ...(adresse && { adresse }),
          ...(role && { role }),
          ...(etat && { etat }),
          ...(passwordHash && { passwordHash }),
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: memberId,
          action: "MODIFICATION_MEMBRE",
          entite: "User",
          entiteId: memberId,
        },
      });

      // Notifications ADMIN & SUPER_ADMIN
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
            titre: "Membre modifié",
            message: `Les informations de ${updated.prenom} ${updated.nom} ont été modifiées.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/admin/membres/${memberId}`,
          })),
        });
      }

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    console.error(error);

    if (
      error instanceof Error &&
      error.message === "MEMBRE_INTRouvable"
    ) {
      return NextResponse.json(
        { message: "Membre introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Erreur lors de la modification du membre" },
      { status: 500 }
    );
  }
}

/**
 * ==========================
 * DELETE /admin/membres/[id]
 * ==========================
 * Supprimer un membre
 */
export async function DELETE(
  _req: Request,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const memberId = Number(id);

    if (isNaN(memberId)) {
      return NextResponse.json(
        { message: "ID invalide" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const membre = await tx.user.findUnique({
        where: { id: memberId },
      });

      if (!membre) {
        throw new Error("MEMBRE_INTRouvable");
      }

      await tx.user.delete({
        where: { id: memberId },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: memberId,
          action: "SUPPRESSION_MEMBRE",
          entite: "User",
          entiteId: memberId,
        },
      });

      // Notifications ADMIN & SUPER_ADMIN
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
            titre: "Membre supprimé",
            message: `Le membre ${membre.prenom} ${membre.nom} a été supprimé.`,
            priorite: PrioriteNotification.HAUTE,
            actionUrl: `/admin/membres`,
          })),
        });
      }

      return true;
    });

    return NextResponse.json({ success: result });
  } catch (error: unknown) {
    console.error(error);

    if (
      error instanceof Error &&
      error.message === "MEMBRE_INTRouvable"
    ) {
      return NextResponse.json(
        { message: "Membre introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Erreur lors de la suppression du membre" },
      { status: 500 }
    );
  }
}
