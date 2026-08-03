import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { genererBalanceAgee } from "@/lib/comptabilite/balanceAgee";

/**
 * GET /api/comptable/balance-agee?type=CLIENT|FOURNISSEUR
 * Balance âgée (CDC §16-17) — ventilation du solde dû par tiers en tranches
 * d'ancienneté 0-30/31-60/61-90/90j+, calculée depuis les lignes non lettrées.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const type = req.nextUrl.searchParams.get("type") === "FOURNISSEUR" ? "FOURNISSEUR" : "CLIENT";
    const data = await genererBalanceAgee(prisma, type);

    const totaux = data.reduce(
      (s, l) => ({
        tranche0_30: s.tranche0_30 + l.tranche0_30,
        tranche31_60: s.tranche31_60 + l.tranche31_60,
        tranche61_90: s.tranche61_90 + l.tranche61_90,
        tranche90Plus: s.tranche90Plus + l.tranche90Plus,
        total: s.total + l.total,
      }),
      { tranche0_30: 0, tranche31_60: 0, tranche61_90: 0, tranche90Plus: 0, total: 0 },
    );

    return NextResponse.json({ data, totaux });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
