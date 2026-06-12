import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { RIA_REF_PREFIX } from "@/lib/riaComptable";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const dateMin = searchParams.get("dateMin");
    const dateMax = searchParams.get("dateMax");

    const ecritureWhere: Prisma.EcritureComptableWhereInput = {
      reference: { startsWith: RIA_REF_PREFIX },
      ...(dateMin || dateMax
        ? { date: { ...(dateMin ? { gte: new Date(dateMin) } : {}), ...(dateMax ? { lte: new Date(dateMax + "T23:59:59") } : {}) } }
        : {}),
    };

    // Récupérer toutes les lignes RIA groupées par compte
    const lignes = await prisma.ligneEcriture.findMany({
      where: { ecriture: ecritureWhere },
      include: {
        compte: { select: { id: true, numero: true, libelle: true, type: true, sens: true, classe: true } },
      },
    });

    // Agréger par compte
    const map = new Map<number, {
      compteId: number; numero: string; libelle: string; type: string; sens: string; classe: number;
      totalDebit: number; totalCredit: number;
    }>();

    for (const l of lignes) {
      const c = l.compte;
      if (!map.has(c.id)) {
        map.set(c.id, { compteId: c.id, numero: c.numero, libelle: c.libelle, type: c.type, sens: c.sens, classe: c.classe, totalDebit: 0, totalCredit: 0 });
      }
      const entry = map.get(c.id)!;
      entry.totalDebit  += Number(l.debit);
      entry.totalCredit += Number(l.credit);
    }

    const balance = Array.from(map.values())
      .map((e) => ({
        ...e,
        solde:        e.sens === "DEBITEUR" ? e.totalDebit - e.totalCredit : e.totalCredit - e.totalDebit,
        soldeDebiteur: Math.max(0, e.totalDebit - e.totalCredit),
        soldeCrediteur: Math.max(0, e.totalCredit - e.totalDebit),
      }))
      .sort((a, b) => a.numero.localeCompare(b.numero));

    const totaux = balance.reduce(
      (acc, r) => ({
        debit:  acc.debit  + r.totalDebit,
        credit: acc.credit + r.totalCredit,
        soldeDebiteur:  acc.soldeDebiteur  + r.soldeDebiteur,
        soldeCrediteur: acc.soldeCrediteur + r.soldeCrediteur,
      }),
      { debit: 0, credit: 0, soldeDebiteur: 0, soldeCrediteur: 0 }
    );

    return NextResponse.json({ balance, totaux });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
