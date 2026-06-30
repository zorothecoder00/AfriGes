import { NextResponse } from "next/server";
import { getRIASession } from "@/lib/authRIA";
import { evaluerRetardsRIA } from "@/lib/riaRecouvrement";

/**
 * POST /api/admin/ria/recouvrement/escalade
 *
 * Lance le scénario de défaillance client RIA (même moteur que le cron Vercel
 * /api/cron/ria/retards) :
 *   - calcule le retard de chaque financement échu ;
 *   - franchit les nouveaux paliers N1→N5 (relance → agent → chef d'agence → RVP → DG) ;
 *   - met à jour phase (NORMAL→PRECONTENTIEUX→CONTENTIEUX→PERTE) et statut ;
 *   - immobilise le capital (engage → bloque) au passage en DEFAUT.
 *
 * Idempotent : un palier déjà franchi n'est pas re-notifié.
 */
export async function POST() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const r = await evaluerRetardsRIA();
    return NextResponse.json({
      message: "Escalade effectuée",
      ...r,
    });
  } catch (error) {
    console.error("POST /api/admin/ria/recouvrement/escalade", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
