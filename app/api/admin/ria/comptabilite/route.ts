import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { RIA_REF_PREFIX } from "@/lib/riaComptable";

export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const where = { reference: { startsWith: RIA_REF_PREFIX } };

    const [ecritures, lignesAgg] = await Promise.all([
      prisma.ecritureComptable.findMany({
        where,
        select: { reference: true, statut: true },
      }),
      prisma.ligneEcriture.aggregate({
        where: { ecriture: where },
        _sum: { debit: true, credit: true },
      }),
    ]);

    const totalEcritures = ecritures.length;
    const totalDebit     = Number(lignesAgg._sum.debit  ?? 0);
    const totalCredit    = Number(lignesAgg._sum.credit ?? 0);

    // Comptage par type (déduit du préfixe de référence)
    const parType: Record<string, number> = {};
    for (const e of ecritures) {
      const parts = e.reference.split("-");
      const type  = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : e.reference;
      parType[type] = (parType[type] ?? 0) + 1;
    }

    // Comptes RIA actifs (présents dans au moins une ligne RIA)
    const comptesUtilises = await prisma.compteComptable.findMany({
      where: {
        lignesEcriture: { some: { ecriture: where } },
        actif: true,
      },
      select: { id: true, numero: true, libelle: true, type: true, sens: true },
      orderBy: { numero: "asc" },
    });

    return NextResponse.json({
      stats: { totalEcritures, totalDebit, totalCredit, equilibre: Math.abs(totalDebit - totalCredit) < 0.01, parType },
      comptes: comptesUtilises,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
