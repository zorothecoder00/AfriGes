import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";
import { TypeCommissionRIA, TypeEchangeIC } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const echanges = await prisma.echangeInterCommission.findMany({
      where: { dossierId: parseInt(id) },
      include: { auteur: { select: { id: true, nom: true, prenom: true, photo: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ echanges });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const userId = parseInt(auth.session.user.id);
    const dossierId = parseInt(id);
    const body = await req.json();
    const { commission, type, contenu, pieceJointeUrl } = body;

    if (!commission || !type || !contenu) {
      return NextResponse.json({ error: "commission, type et contenu requis" }, { status: 400 });
    }

    if (auth.commission !== null) {
      const dossier = await prisma.dossierInterCommission.findUnique({
        where: { id: dossierId },
        select: { commissionEmettrice: true, commissionReceptrice: true },
      });
      if (!dossier) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });

      const membre = await prisma.membreCommissionRIA.findFirst({
        where: { userId, actif: true, typeCommission: { in: [dossier.commissionEmettrice, dossier.commissionReceptrice] } },
      });
      if (!membre) return NextResponse.json({ error: "Accès refusé à ce dossier" }, { status: 403 });
    }

    const echange = await prisma.echangeInterCommission.create({
      data: {
        dossierId,
        auteurId:      userId,
        commission:    commission as TypeCommissionRIA,
        type:          type as TypeEchangeIC,
        contenu,
        pieceJointeUrl: pieceJointeUrl ?? null,
      },
      include: { auteur: { select: { id: true, nom: true, prenom: true } } },
    });

    return NextResponse.json(echange, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
