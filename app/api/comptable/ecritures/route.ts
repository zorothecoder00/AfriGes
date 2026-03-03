import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

// Génère une référence unique : JNL-YYYYMM-XXXXX
async function generateReference(journal: string): Promise<string> {
  const prefix = journal.slice(0, 3).toUpperCase();
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const count = await prisma.ecritureComptable.count();
  return `${prefix}-${ym}-${String(count + 1).padStart(5, "0")}`;
}

export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page    = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit   = Math.min(200, Math.max(1, Number(searchParams.get("limit") || 50)));
    const skip    = (page - 1) * limit;
    const journal = searchParams.get("journal");
    const statut  = searchParams.get("statut");
    const search  = searchParams.get("search") || "";
    const dateMin = searchParams.get("dateMin");
    const dateMax = searchParams.get("dateMax");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      ...(journal && { journal }),
      ...(statut  && { statut }),
      ...(search  && {
        OR: [
          { reference: { contains: search, mode: "insensitive" } },
          { libelle:   { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(dateMin || dateMax
        ? {
            date: {
              ...(dateMin && { gte: new Date(dateMin) }),
              ...(dateMax && { lte: new Date(dateMax + "T23:59:59") }),
            },
          }
        : {}),
    };

    const [ecritures, total] = await Promise.all([
      prisma.ecritureComptable.findMany({
        where,
        include: {
          lignes: {
            include: {
              compte: { select: { id: true, numero: true, libelle: true, type: true } },
            },
            orderBy: { id: "asc" },
          },
          user: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.ecritureComptable.count({ where }),
    ]);

    // Totaux débit/crédit pour info
    const totaux = await prisma.ligneEcriture.aggregate({
      where: { ecriture: where },
      _sum: { debit: true, credit: true },
    });

    return NextResponse.json({
      data: ecritures,
      totaux: {
        debit:  totaux._sum.debit  ?? 0,
        credit: totaux._sum.credit ?? 0,
      },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { date, libelle, journal, notes, lignes } = body;

    // Validations de base
    if (!date || !libelle || !journal) {
      return NextResponse.json({ error: "date, libelle et journal sont obligatoires" }, { status: 400 });
    }
    if (!Array.isArray(lignes) || lignes.length < 2) {
      return NextResponse.json({ error: "Une écriture nécessite au moins 2 lignes" }, { status: 400 });
    }

    // Validation équilibre débit = crédit
    let totalDebit  = 0;
    let totalCredit = 0;
    for (const l of lignes) {
      if (!l.compteId) return NextResponse.json({ error: "Chaque ligne doit avoir un compteId" }, { status: 400 });
      const d = Number(l.debit  || 0);
      const c = Number(l.credit || 0);
      if (d < 0 || c < 0) return NextResponse.json({ error: "Les montants ne peuvent pas être négatifs" }, { status: 400 });
      if (d > 0 && c > 0) return NextResponse.json({ error: "Une ligne ne peut pas avoir débit ET crédit non nuls simultanément" }, { status: 400 });
      totalDebit  += d;
      totalCredit += c;
    }

    // Tolérance d'arrondi 0.01
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json({
        error: `L'écriture n'est pas équilibrée : débit ${totalDebit.toFixed(2)} ≠ crédit ${totalCredit.toFixed(2)}`,
      }, { status: 400 });
    }

    const reference = await generateReference(journal);

    const ecriture = await prisma.ecritureComptable.create({
      data: {
        reference,
        date:    new Date(date),
        libelle,
        journal,
        notes:   notes || null,
        statut:  "BROUILLON" as import("@prisma/client").StatutEcriture,
        userId:  Number(session.user.id),
        lignes: {
          create: lignes.map((l: {
            compteId: number;
            libelle?: string;
            debit?: number;
            credit?: number;
            isTva?: boolean;
            tauxTva?: number;
            montantTva?: number;
          }) => ({
            compteId:   Number(l.compteId),
            libelle:    l.libelle || libelle,
            debit:      Number(l.debit  || 0),
            credit:     Number(l.credit || 0),
            isTva:      Boolean(l.isTva),
            tauxTva:    l.tauxTva    != null ? Number(l.tauxTva)    : null,
            montantTva: l.montantTva != null ? Number(l.montantTva) : null,
          })),
        },
      },
      include: {
        lignes: {
          include: { compte: { select: { id: true, numero: true, libelle: true } } },
        },
      },
    });

    return NextResponse.json({ data: ecriture }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
