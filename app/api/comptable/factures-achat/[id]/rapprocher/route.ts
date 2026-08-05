import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/comptable/factures-achat/[id]/rapprocher
 * Body: { receptionApproId? } — marque la facture rapprochée, optionnellement
 * en la liant à une réception précise. Action manuelle du comptable (CDC §73 :
 * jamais de rapprochement automatique silencieux).
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "comptabilite", "VALIDATION");
    if (denied) return denied;

    const { id } = await params;
    const factureId = Number(id);
    const facture = await prisma.factureAchat.findUnique({ where: { id: factureId } });
    if (!facture) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    if (facture.statutRapprochement === "RAPPROCHEE") {
      return NextResponse.json({ error: "Facture déjà rapprochée" }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const receptionApproId = body?.receptionApproId ? Number(body.receptionApproId) : facture.receptionApproId;

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const updated = await prisma.$transaction(async (tx) => {
      const f = await tx.factureAchat.update({
        where: { id: factureId },
        data: {
          statutRapprochement: "RAPPROCHEE",
          dateRapprochement: new Date(),
          rapprocheParId: userId,
          ...(receptionApproId != null && { receptionApproId }),
        },
      });
      await auditLog(tx, userId, "RAPPROCHEMENT_FACTURE_ACHAT", "FactureAchat", f.id, { numero: f.numero, receptionApproId }, meta);
      return f;
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
