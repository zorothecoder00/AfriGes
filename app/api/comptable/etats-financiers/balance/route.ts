import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableLectureSession } from "@/lib/authComptable";
import { genererBalanceGenerale } from "@/lib/comptabilite/grandLivreBalance";

/**
 * GET /api/comptable/etats-financiers/balance
 * Query: dateDebut, dateFin (défaut : année civile en cours), compteId?,
 * classe?, journal?, pointDeVenteId?, sectionAnalytiqueId?, tiersType?
 * Balance générale réelle (CDC §33) — dérivée exclusivement des écritures
 * comptables, jamais des modules opérationnels.
 */
export async function GET(req: Request) {
  try {
    const session = await getComptableLectureSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const dateDebut = searchParams.get("dateDebut") ? new Date(searchParams.get("dateDebut")!) : new Date(now.getFullYear(), 0, 1);
    const dateFin = searchParams.get("dateFin") ? new Date(`${searchParams.get("dateFin")}T23:59:59`) : now;
    const compteId = searchParams.get("compteId") ? Number(searchParams.get("compteId")) : undefined;
    const classe = searchParams.get("classe") ? Number(searchParams.get("classe")) : undefined;
    const journal = searchParams.get("journal") || undefined;
    const pointDeVenteId = searchParams.get("pointDeVenteId") ? Number(searchParams.get("pointDeVenteId")) : undefined;
    const sectionAnalytiqueId = searchParams.get("sectionAnalytiqueId") ? Number(searchParams.get("sectionAnalytiqueId")) : undefined;
    const tiersTypeRaw = searchParams.get("tiersType");
    const tiersType = tiersTypeRaw === "CLIENT" || tiersTypeRaw === "FOURNISSEUR" ? tiersTypeRaw : undefined;

    const lignes = await genererBalanceGenerale(prisma, {
      dateDebut, dateFin, compteId, classe, journal, pointDeVenteId, sectionAnalytiqueId, tiersType,
    });

    const totaux = lignes.reduce(
      (acc, l) => ({
        soldeInitial: acc.soldeInitial + l.soldeInitial,
        mouvementDebit: acc.mouvementDebit + l.mouvementDebit,
        mouvementCredit: acc.mouvementCredit + l.mouvementCredit,
        soldeFinalDebiteur: acc.soldeFinalDebiteur + l.soldeFinalDebiteur,
        soldeFinalCrediteur: acc.soldeFinalCrediteur + l.soldeFinalCrediteur,
      }),
      { soldeInitial: 0, mouvementDebit: 0, mouvementCredit: 0, soldeFinalDebiteur: 0, soldeFinalCrediteur: 0 },
    );

    return NextResponse.json({ data: lignes, totaux, periode: { debut: dateDebut, fin: dateFin } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
