import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { calculerSegmentsRFM } from "@/lib/audienceMarketing";

/**
 * POST /api/admin/marketing/audiences/reactivation
 * CDC §15 — "Le système propose : Campagne de réactivation" pour les clients
 * détectés à risque (segment RFM A_RISQUE). Comme ce segment est calculé (pas
 * un champ de règle d'audience classique, CDC §11), on fige directement la
 * liste de membres plutôt que de passer par `figerAudienceStatique`/`regles`.
 */
export async function POST() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const resultats = await calculerSegmentsRFM();
    const clientIds = resultats.filter((r) => r.segment === "A_RISQUE").map((r) => r.clientId);
    if (clientIds.length === 0) {
      return NextResponse.json({ error: "Aucun client à risque actuellement" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const nom = `Réactivation clients à risque — ${new Date().toLocaleDateString("fr-FR")}`;
    const audience = await prisma.audienceMarketing.create({
      data: {
        nom,
        description: "Audience générée automatiquement à partir du segment RFM « À risque » (CDC §15).",
        type: "STATIQUE",
        creeParId: userId,
        tailleCalculee: clientIds.length,
        dateDernierCalcul: new Date(),
        membres: { createMany: { data: clientIds.map((clientId) => ({ clientId })), skipDuplicates: true } },
      },
    });

    return NextResponse.json({ data: { id: audience.id, nom: audience.nom, taille: clientIds.length } }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/audiences/reactivation", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
