import { NextResponse } from "next/server";
import {
  PeriodeCotisation,
  StatutCotisation,
  Role,
  PrioriteNotification,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * ==========================
 * GET /admin/cotisations/[id]
 * ==========================
 * Lire une cotisation specifique
 */
export async function GET(
  _req: Request,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const cotisationId = Number(id);

    if (isNaN(cotisationId)) {
      return NextResponse.json(
        { message: "ID invalide" },
        { status: 400 }
      );
    }

    const cotisation = await prisma.cotisation.findUnique({
      where: { id: cotisationId },
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
    });

    if (!cotisation) {
      return NextResponse.json(
        { message: "Cotisation introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: cotisation });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur lors de la recuperation de la cotisation" },
      { status: 500 }
    );
  }
}

/**
 * ==========================
 * PATCH /admin/cotisations/[id]
 * ==========================
 * Modifier une cotisation
 */
export async function PATCH(
  req: Request,
  { params }: RouteParams
) {
  try {
    const session = await getAuthSession();
    const { id } = await params;
    const cotisationId = Number(id);

    if (isNaN(cotisationId)) {
      return NextResponse.json(
        { message: "ID invalide" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { montant, periode, datePaiement, dateExpiration, statut } = body;

    if (
      periode &&
      !Object.values(PeriodeCotisation).includes(periode)
    ) {
      return NextResponse.json(
        { message: "Periode invalide" },
        { status: 400 }
      );
    }

    if (
      statut &&
      !Object.values(StatutCotisation).includes(statut)
    ) {
      return NextResponse.json(
        { message: "Statut invalide" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const cotisation = await tx.cotisation.findUnique({
        where: { id: cotisationId },
        include: { client: true },
      });

      if (!cotisation) {
        throw new Error("COTISATION_INTROUVABLE");
      }

      const updated = await tx.cotisation.update({
        where: { id: cotisationId },
        data: {
          ...(montant !== undefined && { montant }),
          ...(periode && { periode }),
          ...(statut && { statut }),
          ...(dateExpiration && { dateExpiration: new Date(dateExpiration) }),
          ...(datePaiement !== undefined && {
            datePaiement: datePaiement ? new Date(datePaiement) : null,
          }),
        },
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
      });

      // Audit log - userId = admin connecté
      await tx.auditLog.create({
        data: {
          userId: session ? parseInt(session.user.id) : null,
          action: "MODIFICATION_COTISATION",
          entite: "Cotisation",
          entiteId: cotisationId,
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
        const clientNom = cotisation.client
          ? `${cotisation.client.prenom} ${cotisation.client.nom}`
          : "Client inconnu";
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            titre: "Cotisation modifiee",
            message: `La cotisation de ${clientNom} a ete modifiee.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/admin/cotisations/${cotisationId}`,
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
      error.message === "COTISATION_INTROUVABLE"
    ) {
      return NextResponse.json(
        { message: "Cotisation introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Erreur lors de la modification de la cotisation" },
      { status: 500 }
    );
  }
}
