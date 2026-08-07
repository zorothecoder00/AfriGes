import { NextResponse } from "next/server";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { journalMarketingClient } from "@/lib/journalMarketing";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/marketing/clients/[id]/journal — journal marketing unifié du client (CDC §76). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const journal = await journalMarketingClient(clientId);
    return NextResponse.json({ data: journal });
  } catch (e) {
    console.error("GET /api/admin/marketing/clients/[id]/journal", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
