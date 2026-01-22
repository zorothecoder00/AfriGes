import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {

    const { id } = await context.params; // ✅ IMPORTANT
    
    // 1️⃣ Vérifier l'authentification
    const session = await getAuthSession();

    if (!session?.user) {
      return NextResponse.json(
        { message: "Non autorisé" },
        { status: 401 }
      );
    }

    const transactionId = Number(id);

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { message: "ID de transaction invalide" },
        { status: 400 }
      );
    }

    // 2️⃣ Récupérer l'utilisateur + wallet
    const user = await prisma.user.findUnique({
      where: { id: Number(session.user.id) },
      include: { wallet: true },
    });

    if (!user?.wallet) {
      return NextResponse.json(
        { message: "Wallet introuvable" },
        { status: 404 }
      );
    }

    // 3️⃣ Récupérer la transaction
    const transaction = await prisma.walletTransaction.findFirst({
      where: {
        id: transactionId,
        walletId: user.wallet.id, // 🔐 sécurité : appartient au user
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { message: "Transaction introuvable" },
        { status: 404 }
      );
    }

    // 4️⃣ Retourner la transaction
    return NextResponse.json({ data: transaction });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur serveur" },
      { status: 500 }
    );
  }
}
