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
    const compteId = searchParams.get("compteId");
    const dateMin  = searchParams.get("dateMin");
    const dateMax  = searchParams.get("dateMax");

    if (!compteId) {
      return NextResponse.json({ error: "compteId est requis" }, { status: 400 });
    }

    const compte = await prisma.compteComptable.findUnique({
      where: { id: parseInt(compteId) },
      select: { id: true, numero: true, libelle: true, type: true, sens: true },
    });
    if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    const ecritureWhere: Prisma.EcritureComptableWhereInput = {
      reference: { startsWith: RIA_REF_PREFIX },
      ...(dateMin || dateMax
        ? { date: { ...(dateMin ? { gte: new Date(dateMin) } : {}), ...(dateMax ? { lte: new Date(dateMax + "T23:59:59") } : {}) } }
        : {}),
    };

    const lignes = await prisma.ligneEcriture.findMany({
      where: { compteId: parseInt(compteId), ecriture: ecritureWhere },
      include: {
        ecriture: { select: { reference: true, date: true, libelle: true, journal: true } },
      },
      orderBy: { ecriture: { date: "asc" } },
    });

    // Calcul du solde courant
    let solde = 0;
    const mouvements = lignes.map((l) => {
      const d = Number(l.debit);
      const c = Number(l.credit);
      solde += compte.sens === "DEBITEUR" ? (d - c) : (c - d);
      return {
        id:        l.id,
        date:      l.ecriture.date,
        reference: l.ecriture.reference,
        libelle:   l.libelle || l.ecriture.libelle,
        journal:   l.ecriture.journal,
        debit:     d,
        credit:    c,
        solde,
      };
    });

    const totalDebit  = lignes.reduce((s, l) => s + Number(l.debit),  0);
    const totalCredit = lignes.reduce((s, l) => s + Number(l.credit), 0);

    return NextResponse.json({
      compte,
      mouvements,
      totaux: { debit: totalDebit, credit: totalCredit, solde },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
