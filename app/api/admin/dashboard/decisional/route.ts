import { NextResponse } from "next/server";
import { getDashboardDecisionnel } from "@/lib/getDashboardAdmin";

export async function GET() {
  try {
    const data = await getDashboardDecisionnel();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/admin/dashboard/decisional", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
