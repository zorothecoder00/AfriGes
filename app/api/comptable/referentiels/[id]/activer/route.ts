import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/comptable/referentiels/[id]/activer
 * Bascule le référentiel actif (CDC §77) — ConfigurationComptableInitiale.referentielActifId.
 * Ne modifie jamais l'historique des référentiels précédents.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "comptabilite", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const referentielId = Number(id);
    const referentiel = await prisma.referentielComptable.findUnique({ where: { id: referentielId } });
    if (!referentiel) return NextResponse.json({ error: "Référentiel introuvable" }, { status: 404 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const config = await prisma.$transaction(async (tx) => {
      await tx.configurationComptableInitiale.upsert({
        where: { id: 1 },
        create: { id: 1, referentielActifId: referentielId },
        update: { referentielActifId: referentielId },
      });
      await auditLog(tx, userId, "ACTIVATION_REFERENTIEL_COMPTABLE", "ReferentielComptable", referentielId, { code: referentiel.code }, meta);
      return tx.configurationComptableInitiale.findUnique({ where: { id: 1 } });
    });

    return NextResponse.json({ data: config });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
