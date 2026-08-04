import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { getRequestMeta } from "@/lib/requestMeta";
import { auditLog } from "@/lib/notifications";
import { comptabiliserEcheance } from "@/lib/comptabilite/regularisationsAvance";

type Ctx = { params: Promise<{ id: string; echeanceId: string }> };

/** POST /api/comptable/regularisations/[id]/echeances/[echeanceId]/comptabiliser */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { echeanceId } = await params;
    const id = Number(echeanceId);
    if (isNaN(id)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);

    const result = await prisma.$transaction(async (tx) => {
      const r = await comptabiliserEcheance(tx, id, userId);
      await auditLog(tx, userId, "COMPTABILISATION_ECHEANCE_REGULARISATION", "EcheanceRegularisation", id, undefined, meta);
      return r;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    if (e instanceof Error && ["ECHEANCE_INTROUVABLE", "ECHEANCE_DEJA_COMPTABILISEE"].includes(e.message)) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
