import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { TypeCommissionRIA, TypeEchangeIC } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

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
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { commission, type, contenu, pieceJointeUrl } = body;

    if (!commission || !type || !contenu) {
      return NextResponse.json({ error: "commission, type et contenu requis" }, { status: 400 });
    }

    const echange = await prisma.echangeInterCommission.create({
      data: {
        dossierId:     parseInt(id),
        auteurId:      parseInt(session.user.id),
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
