import { NextResponse } from "next/server";
import {
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
            uuid: true,
            nom: true,
            prenom: true,
            email: true,
            photo: true,
            role: true,
            telephone: true,
            adresse: true,
            etat: true,
            dateAdhesion: true,
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
    const { role, actif, email, googleOnly } = body;

    if (
      role &&
      !Object.values(RoleGestionnaire).includes(role)
    ) {
      return NextResponse.json(
        { message: "Rôle de gestionnaire invalide" },
        { status: 400 }
      );
    }

    // E-mail : normalisation + validation de format (l'unicité est vérifiée en transaction).
    let emailNormalized: string | undefined;
    if (email !== undefined && email !== null && String(email).trim() !== "") {
      const e = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        return NextResponse.json(
          { message: "Adresse e-mail invalide" },
          { status: 400 }
        );
      }
      emailNormalized = e;
    }

    const result = await prisma.$transaction(async (tx) => {
      const gestionnaire = await tx.gestionnaire.findUnique({
        where: { id: gestionnaireId },
        include: { member: true },
      });

      if (!gestionnaire) {
        throw new Error("Gestionnaire introuvable");
      }

      // Déterminer le role global
      let newMemberRole: Role | undefined;

      if (role === RoleGestionnaire.SUPER_ADMIN) {
        newMemberRole = Role.SUPER_ADMIN;
      } else if (role === RoleGestionnaire.ADMIN) {
        newMemberRole = Role.ADMIN;
      } else if (role) {
        newMemberRole = Role.USER;
      }

      const updated = await tx.gestionnaire.update({
        where: { id: gestionnaireId },
        data: {
          ...(role && { role }),
          ...(typeof actif === "boolean" && { actif }),
        },
      });

      // E-mail unique : refuser s'il est déjà utilisé par un autre compte.
      if (emailNormalized) {
        const clash = await tx.user.findFirst({
          where: { email: emailNormalized, id: { not: gestionnaire.memberId } },
          select: { id: true },
        });
        if (clash) throw new Error("EMAIL_TAKEN");
      }

      // Mettre à jour le membre (User) : rôle, e-mail, et/ou désactivation du mot de passe.
      // googleOnly = true → passwordHash null → la connexion par mot de passe est
      // désactivée pour ce compte ; il ne pourra plus se connecter que via Google.
      const memberData: { role?: Role; email?: string; passwordHash?: null } = {};
      if (newMemberRole) memberData.role = newMemberRole;
      if (emailNormalized) memberData.email = emailNormalized;
      if (googleOnly === true) memberData.passwordHash = null;

      if (Object.keys(memberData).length > 0) {
        await tx.user.update({
          where: { id: gestionnaire.memberId },
          data: memberData,
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: gestionnaire.memberId,
          action: "MODIFICATION_GESTIONNAIRE",
          entite: "Gestionnaire",
          entiteId: gestionnaireId,
          details: {
            ...(role && { role }),
            ...(emailNormalized && { emailChange: emailNormalized }),
            ...(googleOnly === true && { passwordDisabled: true }),
          },
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

    if (error instanceof Error && error.message === "EMAIL_TAKEN") {
      return NextResponse.json(
        { message: "Cette adresse e-mail est déjà utilisée par un autre compte." },
        { status: 409 }
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
            actionUrl: `/dashboard/admin/gestionnaires`,
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
