import { NextResponse } from "next/server";
import { getDashboardDecisionnel } from "@/lib/getDashboardAdmin";
import { getAdminSession } from "@/lib/authAdmin";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const data = await getDashboardDecisionnel();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/admin/dashboard/decisional", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
