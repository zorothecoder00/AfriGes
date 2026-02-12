import { NextResponse } from "next/server";
import { Prisma, Role, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/user/credits
 * Liste les credits de l'utilisateur connecte avec stats
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const memberId = Number(session.user.id);

    const credits = await prisma.credit.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    // Statistiques
    const totalEmprunte = credits.reduce((sum, c) => sum + Number(c.montant), 0);
    const totalRestant = credits.reduce((sum, c) => sum + Number(c.montantRestant), 0);
    const creditsActifs = credits.filter((c) =>
      ["EN_ATTENTE", "APPROUVE", "REMBOURSE_PARTIEL"].includes(c.statut)
    ).length;

    return NextResponse.json({
      data: credits,
      stats: {
        totalEmprunte,
        totalRestant,
        creditsActifs,
      },
    });
  } catch (error) {
    console.error("GET /user/credits error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des credits" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/credits
 * Demander un nouveau credit
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const memberId = Number(session.user.id);
    const body = await req.json();
    const { montant } = body;

    if (!montant || Number(montant) <= 0) {
      return NextResponse.json(
        { error: "Le montant doit etre superieur a 0" },
        { status: 400 }
      );
    }

    const credit = await prisma.$transaction(async (tx) => {
      const created = await tx.credit.create({
        data: {
          memberId,
          montant: new Prisma.Decimal(montant),
          montantRestant: new Prisma.Decimal(montant),
        },
      });

      const admins = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });

      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            titre: "Nouvelle demande de credit",
            message: `Une demande de credit de ${montant} EUR a ete soumise.`,
            priorite: PrioriteNotification.HAUTE,
            actionUrl: `/dashboard/admin/credits`,
          })),
        });
      }

      return created;
    });

    return NextResponse.json({ data: credit }, { status: 201 });
  } catch (error) {
    console.error("POST /user/credits error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la demande de credit" },
      { status: 500 }
    );
  }
}
