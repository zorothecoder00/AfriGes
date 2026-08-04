import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 24)));
    const skip   = (page - 1) * limit;
    const statut = searchParams.get("statut");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = statut ? { statut } : {};

    const [rapprochements, total] = await Promise.all([
      prisma.rapprochementBancaire.findMany({
        where,
        include: { user: { select: { id: true, nom: true, prenom: true } } },
        orderBy: { periode: "desc" },
        skip,
        take: limit,
      }),
      prisma.rapprochementBancaire.count({ where }),
    ]);

    return NextResponse.json({
      data: rapprochements,
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
    const { periode, soldeBancaireReel, notes } = body;

    if (!periode)              return NextResponse.json({ error: "La période est obligatoire" }, { status: 400 });
    if (soldeBancaireReel == null) return NextResponse.json({ error: "Le solde bancaire réel est obligatoire" }, { status: 400 });

    // Calculer le solde comptable depuis les lignes du compte banque (521)
    const [year, month] = periode.split("-").map(Number);
    const debut = new Date(year, month - 1, 1);
    const fin   = new Date(year, month, 0, 23, 59, 59);

    const lignesBanque = await prisma.ligneEcriture.findMany({
      where: {
        compte:   { numero: { startsWith: "521" } },
        ecriture: {
          date:   { gte: debut, lte: fin },
          statut: "VALIDE",
        },
      },
    });

    let soldeComptable = 0;
    for (const l of lignesBanque) {
      soldeComptable += Number(l.debit) - Number(l.credit);
    }

    const soldeBancaire = Number(soldeBancaireReel);
    const ecart = soldeBancaire - soldeComptable;

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const rapprochement = await prisma.$transaction(async (tx) => {
      const r = await tx.rapprochementBancaire.upsert({
        where:  { periode },
        update: {
          soldeBancaireReel: soldeBancaire,
          soldeComptable,
          ecart,
          notes:  notes || null,
          statut: (Math.abs(ecart) < 0.01 ? "RAPPROCHE" : "EN_ATTENTE") as import("@prisma/client").StatutRapprochement,
          userId,
        },
        create: {
          periode,
          soldeBancaireReel: soldeBancaire,
          soldeComptable,
          ecart,
          notes:  notes || null,
          statut: (Math.abs(ecart) < 0.01 ? "RAPPROCHE" : "EN_ATTENTE") as import("@prisma/client").StatutRapprochement,
          userId,
        },
      });
      await auditLog(tx, userId, "ENREGISTREMENT_RAPPROCHEMENT_BANCAIRE", "RapprochementBancaire", r.id, { periode, soldeBancaire, soldeComptable, ecart }, meta);
      return r;
    });

    return NextResponse.json({ data: rapprochement }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, statut, notes } = await req.json();
    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.rapprochementBancaire.update({
        where: { id: Number(id) },
        data: {
          ...(statut !== undefined && { statut }),
          ...(notes  !== undefined && { notes }),
        },
      });
      await auditLog(tx, userId, "MODIFICATION_RAPPROCHEMENT_BANCAIRE", "RapprochementBancaire", u.id, { statut, notes }, meta);
      return u;
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
