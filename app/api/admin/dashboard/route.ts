import { NextResponse } from "next/server";
import { getDashboardAdmin } from "@/lib/getDashboardAdmin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const periodParam = Number(searchParams.get("period") ?? "30");
    const period = [7, 30, 90].includes(periodParam) ? periodParam : 30;

    const stats = await getDashboardAdmin(period);

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error("ADMIN DASHBOARD ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Erreur lors du chargement du dashboard admin" },
      { status: 500 }
    );
  }
}
