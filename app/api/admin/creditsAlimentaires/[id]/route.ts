import { NextResponse } from "next/server";
import {
  StatutCreditAlim,
  SourceCreditAlim,
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
 * GET /admin/creditsAlimentaires/[id]
 * ==========================
 * Lire un credit alimentaire specifique
 */
export async function GET(
  _req: Request,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const creditId = Number(id);

    if (isNaN(creditId)) {
      return NextResponse.json(
        { message: "ID invalide" },
        { status: 400 }
      );
    }

    const credit = await prisma.creditAlimentaire.findUnique({
      where: { id: creditId },
      include: {
        client: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            telephone: true,
          },
        },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        ventes: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            produit: {
              select: {
                id: true,
                nom: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!credit) {
      return NextResponse.json(
        { message: "Credit alimentaire introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: credit });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur lors de la recuperation du credit alimentaire" },
      { status: 500 }
    );
  }
}

/**
 * ==========================
 * PATCH /admin/creditsAlimentaires/[id]
 * ==========================
 * Modifier un credit alimentaire
 */
export async function PATCH(
  req: Request,
  { params }: RouteParams
) {
  try {
    const session = await getAuthSession();
    const { id } = await params;
    const creditId = Number(id);

    if (isNaN(creditId)) {
      return NextResponse.json(
        { message: "ID invalide" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { plafond, source, sourceId, dateExpiration, statut, ajustementMontant, raisonAjustement } = body;

    if (
      statut &&
      !Object.values(StatutCreditAlim).includes(statut)
    ) {
      return NextResponse.json(
        { message: "Statut invalide" },
        { status: 400 }
      );
    }

    if (
      source &&
      !Object.values(SourceCreditAlim).includes(source)
    ) {
      return NextResponse.json(
        { message: "Source invalide" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const credit = await tx.creditAlimentaire.findUnique({
        where: { id: creditId },
        include: { client: true },
      });

      if (!credit) {
        throw new Error("CREDIT_INTROUVABLE");
      }

      // Calculate new amounts if adjustment is provided
      let newMontantUtilise = Number(credit.montantUtilise);
      const newPlafond = plafond !== undefined ? Number(plafond) : Number(credit.plafond);

      if (ajustementMontant && ajustementMontant !== 0) {
        newMontantUtilise += Number(ajustementMontant);

        // Create adjustment transaction
        await tx.creditAlimentaireTransaction.create({
          data: {
            creditId,
            montant: Math.abs(ajustementMontant),
            type: "AJUSTEMENT",
            description: raisonAjustement || "Ajustement manuel",
          },
        });
      }

      const newMontantRestant = newPlafond - newMontantUtilise;

      const updated = await tx.creditAlimentaire.update({
        where: { id: creditId },
        data: {
          ...(plafond !== undefined && { plafond }),
          ...(source && { source }),
          ...(sourceId !== undefined && { sourceId }),
          ...(statut && { statut }),
          ...(dateExpiration !== undefined && {
            dateExpiration: dateExpiration ? new Date(dateExpiration) : null,
          }),
          ...(ajustementMontant && {
            montantUtilise: newMontantUtilise,
            montantRestant: newMontantRestant,
          }),
          // Update montantRestant if plafond changed but no adjustment
          ...(!ajustementMontant && plafond !== undefined && {
            montantRestant: newPlafond - Number(credit.montantUtilise),
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
          action: "MODIFICATION_CREDIT_ALIMENTAIRE",
          entite: "CreditAlimentaire",
          entiteId: creditId,
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
        const clientNom = credit.client
          ? `${credit.client.prenom} ${credit.client.nom}`
          : "Client inconnu";
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            titre: "Credit alimentaire modifie",
            message: `Le credit alimentaire de ${clientNom} a ete modifie.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/admin/creditsAlimentaires/${creditId}`,
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
      error.message === "CREDIT_INTROUVABLE"
    ) {
      return NextResponse.json(
        { message: "Credit alimentaire introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Erreur lors de la modification du credit alimentaire" },
      { status: 500 }
    );
  }
}
