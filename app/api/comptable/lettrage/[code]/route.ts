import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { delettrer } from "@/lib/comptabilite/lettrage";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ code: string }> };

/**
 * DELETE /api/comptable/lettrage/[code]
 * Retire le lettrage d'un groupe de lignes (le comptable s'est trompé de rapprochement).
 */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { code } = await params;
    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const count = await prisma.$transaction(async (tx) => {
      const c = await delettrer(tx, code);
      if (c > 0) {
        await auditLog(tx, userId, "SUPPRESSION_LETTRAGE", "LigneEcriture", undefined, { code, count: c }, meta);
      }
      return c;
    });
    if (count === 0) return NextResponse.json({ error: "Aucune ligne trouvée pour ce code" }, { status: 404 });

    return NextResponse.json({ success: true, count });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
