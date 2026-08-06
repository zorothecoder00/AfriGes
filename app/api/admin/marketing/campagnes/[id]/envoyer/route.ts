import { NextResponse } from "next/server";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { envoyerCampagneAAudience, EnvoiCampagneError } from "@/lib/envoiCampagne";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/marketing/campagnes/[id]/envoyer
 * Body: { modeleMessageId, canalId }
 * Envoie le modèle choisi à toute l'audience de la campagne.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const campagneId = Number(id);
    if (isNaN(campagneId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { modeleMessageId, canalId } = body;
    if (!modeleMessageId || !canalId) {
      return NextResponse.json({ error: "modeleMessageId et canalId sont requis" }, { status: 400 });
    }

    const resultat = await envoyerCampagneAAudience({
      campagneId, modeleMessageId: Number(modeleMessageId), canalId: Number(canalId),
      userId: Number(session.user.id),
    });

    return NextResponse.json({ data: resultat });
  } catch (e: unknown) {
    if (e instanceof EnvoiCampagneError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("POST /api/admin/marketing/campagnes/[id]/envoyer", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
