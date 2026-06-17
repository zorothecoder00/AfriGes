import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";
import { TypeCommissionRIA, TypeObservationComm } from "@prisma/client";

// Collaboration interne : observations des commissions du membre connecté.
// Admin / RESPONSABLE_RIA (auth.commission === null) voient/écrivent partout.
export async function GET(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    const { searchParams } = new URL(req.url);
    const typeCommission = searchParams.get("typeCommission") as TypeCommissionRIA | null;
    const type           = searchParams.get("type");
    const limit          = parseInt(searchParams.get("limit") ?? "50");

    const isAdmin = auth.commission === null;
    let typeFilter: object = {};
    if (typeCommission) {
      typeFilter = { typeCommission };
    } else if (!isAdmin) {
      const memberships = await prisma.membreCommissionRIA.findMany({
        where: { userId, actif: true },
        select: { typeCommission: true },
      });
      typeFilter = { typeCommission: { in: memberships.map((m) => m.typeCommission) } };
    }

    const observations = await prisma.observationCommissionRIA.findMany({
      where: {
        ...typeFilter,
        ...(type ? { type: type as TypeObservationComm } : {}),
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

    const userId = parseInt(auth.session.user.id);
    const body = await req.json();
    const { typeCommission, type, contenu, pieceJointeUrl, epingle } = body;

    if (!typeCommission || !type || !contenu) {
      return NextResponse.json({ error: "typeCommission, type et contenu requis" }, { status: 400 });
    }

    // Un membre standard ne peut publier que dans une commission dont il est membre actif.
    if (auth.commission !== null) {
      const estMembre = await prisma.membreCommissionRIA.findFirst({
        where: { userId, typeCommission: typeCommission as TypeCommissionRIA, actif: true },
      });
      if (!estMembre) {
        return NextResponse.json({ error: "Vous devez être membre actif de cette commission" }, { status: 403 });
      }
    }

    const obs = await prisma.observationCommissionRIA.create({
      data: {
        typeCommission: typeCommission as TypeCommissionRIA,
        auteurId:       userId,
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
