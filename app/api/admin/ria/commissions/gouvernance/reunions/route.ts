import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { TypeCommissionRIA } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const typeCommission = searchParams.get("typeCommission") as TypeCommissionRIA | null;
    const statut = searchParams.get("statut");
    const limit = parseInt(searchParams.get("limit") ?? "50");

    const reunions = await prisma.reunionCommissionRIA.findMany({
      where: {
        ...(typeCommission ? { typeCommission } : {}),
        ...(statut ? { statut: statut as never } : {}),
      },
      include: {
        organisateur: { select: { id: true, nom: true, prenom: true } },
        presences: { select: { id: true, present: true, procuration: true } },
        resolutions: { select: { id: true, statut: true } },
        compteRenduStr: { select: { id: true, dateValidation: true } },
      },
      orderBy: { dateHeure: "desc" },
      take: limit,
    });

    return NextResponse.json({ reunions });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { typeCommission, titre, dateHeure, lieu, ordreJour } = body;

    if (!typeCommission || !titre || !dateHeure) {
      return NextResponse.json({ error: "typeCommission, titre et dateHeure requis" }, { status: 400 });
    }

    const reunion = await prisma.reunionCommissionRIA.create({
      data: {
        typeCommission,
        titre,
        dateHeure: new Date(dateHeure),
        lieu,
        ordreJour,
        statut: "PLANIFIEE",
        organisateurId: parseInt(session.user.id),
      },
      include: {
        organisateur: { select: { id: true, nom: true, prenom: true } },
      },
    });

    return NextResponse.json(reunion, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
