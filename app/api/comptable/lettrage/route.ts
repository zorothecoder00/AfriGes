import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { requirePermission } from "@/lib/permissions";
import { lignesNonLettrees, proposerLettrage, appliquerLettrage } from "@/lib/comptabilite/lettrage";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

const MESSAGES: Record<string, [string, number]> = {
  LETTRAGE_MIN_2_LIGNES: ["Un lettrage nécessite au moins 2 lignes", 400],
  LIGNE_INTROUVABLE: ["Une des lignes sélectionnées est introuvable", 404],
  COMPTES_DIFFERENTS: ["Les lignes sélectionnées n'appartiennent pas toutes au même compte", 422],
  DEJA_LETTREE: ["Une des lignes sélectionnées est intégralement lettrée", 422],
  AUCUN_MONTANT_COMMUN: ["Aucun montant commun disponible entre ces lignes", 422],
};

/**
 * GET /api/comptable/lettrage?compteId=123
 * Lignes non lettrées d'un compte auxiliaire + propositions de correspondances
 * exactes (CDC §18) — le comptable confirme avant application.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "comptabilite", "LECTURE");
    if (denied) return denied;

    const compteId = Number(req.nextUrl.searchParams.get("compteId"));
    if (!compteId) return NextResponse.json({ error: "compteId requis" }, { status: 400 });

    const [lignes, propositions] = await Promise.all([
      lignesNonLettrees(prisma, compteId),
      proposerLettrage(prisma, compteId),
    ]);

    return NextResponse.json({ data: { lignes, propositions } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/lettrage
 * Body: { ligneIds: number[] } — applique le lettrage à la sélection.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "comptabilite", "VALIDATION");
    if (denied) return denied;

    const body = await req.json();
    const ligneIds = Array.isArray(body?.ligneIds) ? body.ligneIds.map(Number) : [];

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const code = await prisma.$transaction(async (tx) => {
      const c = await appliquerLettrage(tx, ligneIds);
      await auditLog(tx, userId, "APPLICATION_LETTRAGE", "LigneEcriture", undefined, { code: c, ligneIds }, meta);
      return c;
    });
    return NextResponse.json({ data: { code } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/comptable/lettrage", error);
    if (error instanceof Error && MESSAGES[error.message]) {
      const [message, status] = MESSAGES[error.message];
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
