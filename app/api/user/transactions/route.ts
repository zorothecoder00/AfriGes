import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";   
import { TransactionType, Prisma } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.user) {   
      return NextResponse.json(
        { message: "Non autorisé" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 10)));
    const rawType = searchParams.get("type");
    const type = Object.values(TransactionType).includes(rawType as TransactionType)
      ? (rawType as TransactionType)
      : null;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const skip = (page - 1) * limit;

    // 1️⃣ Récupérer le user + wallet
    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
      include: { wallet: true },
    });

    if (!user?.wallet) {
      return NextResponse.json({
        data: [],
        meta: { page, limit, total: 0, totalPages: 0 },
      });
    }

    // 2️⃣ Construire le filtre dynamique
    const where: Prisma.WalletTransactionWhereInput = {
      walletId: user.wallet.id,
    };

    if (type) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // 3️⃣ Requêtes Prisma
    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return NextResponse.json({
      data: transactions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur serveur" },
      { status: 500 }
    );
  }
}
