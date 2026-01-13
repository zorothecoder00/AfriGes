import { NextResponse } from "next/server";
import { getDashboardUser } from "@/lib/getDashboardUser";
import { getAuthSession } from "@/lib/auth";

export async function GET() {
  try {
    /**
     * 1️⃣ Récupération de la session
     */
    const session = await getAuthSession();

    if (!session || !session.user?.id) {
      return NextResponse.json(
        {
          success: false,
          message: "Non autorisé",
        },
        { status: 401 }
      );
    }

    /**
     * 2️⃣ Récupération des stats du user connecté
     */
    const stats = await getDashboardUser(Number(session.user.id));

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("USER DASHBOARD ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors du chargement du dashboard utilisateur",
      },
      { status: 500 }
    );
  }
}
