import { NextResponse } from "next/server";
import {
  Prisma,
  Role,
  RoleGestionnaire,
  PrioriteNotification,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * ==========================
 * GET /admin/gestionnaires/[id]
 * ==========================
 * Lire un gestionnaire spécifique
 */
export async function GET(
  _req: Request,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const gestionnaireId = Number(id)
    if (isNaN(gestionnaireId)) {
      return NextResponse.json(
        { message: "ID invalide" },
        { status: 400 }
      );
    }

    const gestionnaire = await prisma.gestionnaire.findUnique({
      where: { id: gestionnaireId },
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
    });

    if (!gestionnaire) {
      return NextResponse.json(
        { message: "Gestionnaire introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: gestionnaire });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur lors de la récupération du gestionnaire" },
      { status: 500 }
    );
  }
}

/**
 * ==========================
 * PATCH /admin/gestionnaires/[id]
 * ==========================
 * Modifier un gestionnaire (rôle / actif)
 */
export async function PATCH(
  req: Request,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const gestionnaireId = Number(id);
    if (isNaN(gestionnaireId)) {
      return NextResponse.json(
        { message: "ID invalide" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { role, actif } = body;

    if (
      role &&
      !Object.values(RoleGestionnaire).includes(role)
    ) {
      return NextResponse.json(
        { message: "Rôle de gestionnaire invalide" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const gestionnaire = await tx.gestionnaire.findUnique({
        where: { id: gestionnaireId },
        include: { member: true },
      });

      if (!gestionnaire) {
        throw new Error("Gestionnaire introuvable");
      }

      const updated = await tx.gestionnaire.update({
        where: { id: gestionnaireId },
        data: {
          ...(role && { role }),
          ...(typeof actif === "boolean" && { actif }),
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: gestionnaire.memberId,
          action: "MODIFICATION_GESTIONNAIRE",
          entite: "Gestionnaire",
          entiteId: gestionnaireId,
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
            titre: "Gestionnaire modifié",
            message: `${gestionnaire.member.prenom} ${gestionnaire.member.nom} a été modifié.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/admin/gestionnaires/${gestionnaireId}`,
          })),
        });
      }

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    console.error(error);

    if (error instanceof Error && error.message === "Gestionnaire introuvable") {
      return NextResponse.json(
        { message: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Erreur lors de la modification du gestionnaire" },
      { status: 500 }
    );
  }
}

/**
 * ==========================
 * DELETE /admin/gestionnaires/[id]
 * ==========================
 * Supprimer un gestionnaire
 */
export async function DELETE(
  _req: Request,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const gestionnaireId = Number(id);
    if (isNaN(gestionnaireId)) {
      return NextResponse.json(
        { message: "ID invalide" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const gestionnaire = await tx.gestionnaire.findUnique({
        where: { id: gestionnaireId },
        include: { member: true },
      });

      if (!gestionnaire) {
        throw new Error("Gestionnaire introuvable");
      }

      await tx.gestionnaire.delete({
        where: { id: gestionnaireId },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: gestionnaire.memberId,
          action: "SUPPRESSION_GESTIONNAIRE",
          entite: "Gestionnaire",
          entiteId: gestionnaireId,
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
            titre: "Gestionnaire supprimé",
            message: `${gestionnaire.member.prenom} ${gestionnaire.member.nom} n'est plus gestionnaire.`,
            priorite: PrioriteNotification.HAUTE,
            actionUrl: `/admin/gestionnaires`,
          })),
        });
      }

      return true;
    });

    return NextResponse.json({ success: result });
  } catch (error: unknown) {
    console.error(error);

    if (error instanceof Error && error.message === "Gestionnaire introuvable") {
      return NextResponse.json(
        { message: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Erreur lors de la suppression du gestionnaire" },
      { status: 500 }
    );
  }
}
