import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { delettrer } from "@/lib/comptabilite/lettrage";

type Ctx = { params: Promise<{ code: string }> };

/**
 * DELETE /api/comptable/lettrage/[code]
 * Retire le lettrage d'un groupe de lignes (le comptable s'est trompé de rapprochement).
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { code } = await params;
    const count = await delettrer(prisma, code);
    if (count === 0) return NextResponse.json({ error: "Aucune ligne trouvée pour ce code" }, { status: 404 });

    return NextResponse.json({ success: true, count });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
