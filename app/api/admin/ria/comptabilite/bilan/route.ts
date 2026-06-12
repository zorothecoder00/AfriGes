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

    const lignes = await prisma.ligneEcriture.findMany({
      where: { ecriture: ecritureWhere },
      include: {
        compte: { select: { id: true, numero: true, libelle: true, type: true, sens: true, classe: true } },
      },
    });

    // Agréger par compte
    const map = new Map<number, { compte: typeof lignes[0]["compte"]; debit: number; credit: number }>();
    for (const l of lignes) {
      if (!map.has(l.compteId)) map.set(l.compteId, { compte: l.compte, debit: 0, credit: 0 });
      map.get(l.compteId)!.debit  += Number(l.debit);
      map.get(l.compteId)!.credit += Number(l.credit);
    }

    const rows = Array.from(map.values()).map(({ compte, debit, credit }) => ({
      compteId: compte.id,
      numero:   compte.numero,
      libelle:  compte.libelle,
      type:     compte.type,
      sens:     compte.sens,
      classe:   compte.classe,
      debit,
      credit,
      solde:    compte.sens === "DEBITEUR" ? debit - credit : credit - debit,
    }));

    // Bilan : ACTIF + TRESORERIE vs PASSIF
    const actif     = rows.filter((r) => r.type === "ACTIF" || r.type === "TRESORERIE").sort((a, b) => a.numero.localeCompare(b.numero));
    const passif    = rows.filter((r) => r.type === "PASSIF").sort((a, b) => a.numero.localeCompare(b.numero));
    // Compte de résultat
    const charges   = rows.filter((r) => r.type === "CHARGES").sort((a, b) => a.numero.localeCompare(b.numero));
    const produits  = rows.filter((r) => r.type === "PRODUITS").sort((a, b) => a.numero.localeCompare(b.numero));

    const totalActif    = actif.reduce((s, r)    => s + r.solde, 0);
    const totalPassif   = passif.reduce((s, r)   => s + r.solde, 0);
    const totalCharges  = charges.reduce((s, r)  => s + r.solde, 0);
    const totalProduits = produits.reduce((s, r) => s + r.solde, 0);
    const resultat      = totalProduits - totalCharges;

    return NextResponse.json({
      bilan: { actif, passif, totalActif, totalPassif, equilibre: Math.abs(totalActif - (totalPassif + resultat)) < 1 },
      resultat: { charges, produits, totalCharges, totalProduits, resultat },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
