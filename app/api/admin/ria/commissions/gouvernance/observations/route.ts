import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";
import { TypeCommissionRIA, TypeObservationComm } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const typeCommission = searchParams.get("typeCommission") as TypeCommissionRIA | null;
    const type           = searchParams.get("type");
    const epingle        = searchParams.get("epingle");
    const limit          = parseInt(searchParams.get("limit") ?? "50");

    const observations = await prisma.observationCommissionRIA.findMany({
      where: {
        ...(typeCommission ? { typeCommission }                   : {}),
        ...(type           ? { type: type as TypeObservationComm } : {}),
        ...(epingle        ? { epingle: epingle === "true" }       : {}),
      },
      include: {
        auteur: { select: { id: true, nom: true, prenom: true, photo: true } },
      },
      orderBy: [{ epingle: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    return NextResponse.json({ observations });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { typeCommission, type, contenu, pieceJointeUrl, epingle } = body;

    if (!typeCommission || !type || !contenu) {
      return NextResponse.json({ error: "typeCommission, type et contenu requis" }, { status: 400 });
    }

    const obs = await prisma.observationCommissionRIA.create({
      data: {
        typeCommission: typeCommission as TypeCommissionRIA,
        auteurId:       parseInt(auth.session.user.id),
        type:           type as TypeObservationComm,
        contenu,
        pieceJointeUrl: pieceJointeUrl ?? null,
        epingle:        epingle ?? false,
      },
      include: { auteur: { select: { id: true, nom: true, prenom: true } } },
    });

    return NextResponse.json(obs, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
