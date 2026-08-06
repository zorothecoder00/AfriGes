import { NextResponse } from "next/server";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { recalculerAudience } from "@/lib/audienceMarketing";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/marketing/audiences/[id]/recalculer
 * Force le recalcul d'une audience DYNAMIQUE (CDC §12 : recalcul quotidien
 * automatique — ce endpoint sert aussi de déclencheur manuel et de base pour
 * un futur cron). No-op pour une audience STATIQUE (figée, CDC §13).
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const audienceId = Number(id);
    if (isNaN(audienceId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const { taille } = await recalculerAudience(audienceId);
    return NextResponse.json({ data: { tailleCalculee: taille } });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Audience introuvable") {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    console.error("POST /api/admin/marketing/audiences/[id]/recalculer", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
