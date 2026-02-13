import { NextResponse } from "next/server";
import {
  MemberStatus,
  Role,
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
 * GET /api/admin/clients/[id]
 * ==========================
 * Lire un client specifique avec ses activites
 */
export async function GET(
  _req: Request,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) {
      return NextResponse.json(
        { message: "ID invalide" },
        { status: 400 }
      );
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
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
    });

    if (!client) {
      return NextResponse.json(
        { message: "Client introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: client });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur lors de la recuperation du client" },
      { status: 500 }
    );
  }
}

/**
 * ==========================
 * PATCH /api/admin/clients/[id]
 * ==========================
 * Modifier un client (nom, prenom, telephone, adresse, etat)
 */
export async function PATCH(
  req: Request,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) {
      return NextResponse.json(
        { message: "ID invalide" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { nom, prenom, telephone, adresse, etat } = body;

    // Valider le statut si fourni
    if (etat && !Object.values(MemberStatus).includes(etat)) {
      return NextResponse.json(
        { message: "Statut invalide" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.client.findUnique({
        where: { id: clientId },
      });

      if (!existing) {
        throw new Error("Client introuvable");
      }

      // Verifier doublon telephone si modifie
      if (telephone && telephone !== existing.telephone) {
        const duplicate = await tx.client.findUnique({
          where: { telephone },
        });
        if (duplicate) {
          throw new Error("DUPLICATE_PHONE");
        }
      }

      const updated = await tx.client.update({
        where: { id: clientId },
        data: {
          ...(nom && { nom }),
          ...(prenom && { prenom }),
          ...(telephone && { telephone }),
          ...(adresse !== undefined && { adresse: adresse || null }),
          ...(etat && { etat }),
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "MODIFICATION_CLIENT",
          entite: "Client",
          entiteId: clientId,
        },
      });

      // Notification ADMIN & SUPER_ADMIN
      const admins = await tx.user.findMany({
        where: {
          role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
        },
        select: { id: true },
      });

      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            titre: "Client modifie",
            message: `Le client ${updated.prenom} ${updated.nom} a ete modifie.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/admin/clients/${clientId}`,
          })),
        });
      }

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    console.error(error);

    if (error instanceof Error) {
      if (error.message === "Client introuvable") {
        return NextResponse.json(
          { message: error.message },
          { status: 404 }
        );
      }
      if (error.message === "DUPLICATE_PHONE") {
        return NextResponse.json(
          { message: "Ce numero de telephone est deja utilise par un autre client" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { message: "Erreur lors de la modification du client" },
      { status: 500 }
    );
  }
}

/**
 * ==========================
 * DELETE /api/admin/clients/[id]
 * ==========================
 * Supprimer un client
 */
export async function DELETE(
  _req: Request,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) {
      return NextResponse.json(
        { message: "ID invalide" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
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
      });

      if (!client) {
        throw new Error("Client introuvable");
      }

      // Verifier les relations actives
      const totalRelations =
        client._count.credits +
        client._count.creditsAlim +
        client._count.cotisations +
        client._count.tontines;

      if (totalRelations > 0) {
        throw new Error("RELATIONS_EXIST");
      }

      await tx.client.delete({
        where: { id: clientId },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "SUPPRESSION_CLIENT",
          entite: "Client",
          entiteId: clientId,
        },
      });

      // Notification ADMIN & SUPER_ADMIN
      const admins = await tx.user.findMany({
        where: {
          role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
        },
        select: { id: true },
      });

      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            titre: "Client supprime",
            message: `Le client ${client.prenom} ${client.nom} a ete supprime.`,
            priorite: PrioriteNotification.HAUTE,
            actionUrl: `/dashboard/admin/clients`,
          })),
        });
      }

      return true;
    });

    return NextResponse.json({ success: result });
  } catch (error: unknown) {
    console.error(error);

    if (error instanceof Error) {
      if (error.message === "Client introuvable") {
        return NextResponse.json(
          { message: error.message },
          { status: 404 }
        );
      }
      if (error.message === "RELATIONS_EXIST") {
        return NextResponse.json(
          { message: "Impossible de supprimer ce client car il a des activites associees (credits, cotisations, tontines)" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { message: "Erreur lors de la suppression du client" },
      { status: 500 }
    );
  }
}
