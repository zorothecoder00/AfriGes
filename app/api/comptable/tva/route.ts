import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 24)));
    const skip  = (page - 1) * limit;
    const statut = searchParams.get("statut");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = statut ? { statut } : {};

    const [declarations, total] = await Promise.all([
      prisma.declarationTVA.findMany({
        where,
        include: { user: { select: { id: true, nom: true, prenom: true } } },
        orderBy: { periode: "desc" },
        skip,
        take: limit,
      }),
      prisma.declarationTVA.count({ where }),
    ]);

    return NextResponse.json({
      data: declarations,
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
    const { action, periode, notes } = body;

    // Action : calculer automatiquement la TVA depuis les écritures de la période
    if (action === "calculer") {
      if (!periode) return NextResponse.json({ error: "La période (YYYY-MM) est obligatoire" }, { status: 400 });

      // Récupérer toutes les lignes TVA de la période
      const [year, month] = periode.split("-").map(Number);
      const debut = new Date(year, month - 1, 1);
      const fin   = new Date(year, month, 0, 23, 59, 59);

      const lignesTva = await prisma.ligneEcriture.findMany({
        where: {
          isTva: true,
          ecriture: {
            date:   { gte: debut, lte: fin },
            statut: "VALIDE",
          },
        },
        include: {
          compte: { select: { numero: true, type: true } },
        },
      });

      // TVA collectée = lignes de compte 4431 (crédit) — PASSIF
      // TVA déductible = lignes de compte 4432 (débit) — ACTIF
      let tvaCollectee  = 0;
      let tvaDeductible = 0;

      for (const l of lignesTva) {
        if (l.compte.numero.startsWith("4431")) tvaCollectee  += Number(l.credit);
        if (l.compte.numero.startsWith("4432")) tvaDeductible += Number(l.debit);
      }

      const tvaDue = Math.max(0, tvaCollectee - tvaDeductible);

      return NextResponse.json({
        data: { periode, tvaCollectee, tvaDeductible, tvaDue },
        message: "Calcul effectué. Appelez POST sans action pour enregistrer.",
      });
    }

    // Enregistrement / mise à jour de la déclaration
    const { tvaCollectee, tvaDeductible } = body;
    if (!periode) return NextResponse.json({ error: "La période est obligatoire" }, { status: 400 });
    if (tvaCollectee == null || tvaDeductible == null) {
      return NextResponse.json({ error: "tvaCollectee et tvaDeductible sont obligatoires" }, { status: 400 });
    }

    const coll = Number(tvaCollectee);
    const ded  = Number(tvaDeductible);
    const due  = Math.max(0, coll - ded);

    const declaration = await prisma.declarationTVA.upsert({
      where:  { periode },
      update: { tvaCollectee: coll, tvaDeductible: ded, tvaDue: due, notes: notes || null, statut: "EN_ATTENTE" as import("@prisma/client").StatutTVA },
      create: {
        periode,
        tvaCollectee: coll,
        tvaDeductible: ded,
        tvaDue: due,
        notes:  notes || null,
        statut: "EN_ATTENTE" as import("@prisma/client").StatutTVA,
        userId: Number(session.user.id),
      },
    });

    return NextResponse.json({ data: declaration }, { status: 201 });
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

    const updated = await prisma.declarationTVA.update({
      where: { id: Number(id) },
      data: {
        ...(statut !== undefined && { statut }),
        ...(notes  !== undefined && { notes }),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
