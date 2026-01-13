import { NextResponse } from "next/server";
import { getDashboardAdmin } from "@/lib/getDashboardAdmin";

export async function GET() {
  try {
    const stats = await getDashboardAdmin();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("ADMIN DASHBOARD ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors du chargement du dashboard admin",
      },
      { status: 500 }
    );
  }
}
