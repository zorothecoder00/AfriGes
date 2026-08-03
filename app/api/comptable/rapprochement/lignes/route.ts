import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { proposerRapprochements } from "@/lib/comptabilite/rapprochementImport";

/**
 * GET /api/comptable/rapprochement/lignes?compteNumero=521
 * Lignes de relevé importées pour ce compte + propositions de rapprochement (CDC §19).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const compteNumero = req.nextUrl.searchParams.get("compteNumero");
    if (!compteNumero) return NextResponse.json({ error: "compteNumero requis" }, { status: 400 });

    const [lignes, propositions] = await Promise.all([
      prisma.ligneReleveBancaire.findMany({ where: { compteNumero }, orderBy: { date: "desc" } }),
      proposerRapprochements(prisma, compteNumero),
    ]);

    return NextResponse.json({ data: { lignes, propositions } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
