import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { TypeCommissionRIA, RoleMembreCommissionRIA } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const typeCommission = searchParams.get("typeCommission") as TypeCommissionRIA | null;

    const membres = await prisma.membreCommissionRIA.findMany({
      where: {
        ...(typeCommission ? { typeCommission } : {}),
        actif: true,
      },
      include: {
        user: { select: { id: true, nom: true, prenom: true, email: true, photo: true } },
      },
      orderBy: [{ typeCommission: "asc" }, { role: "asc" }],
    });

    return NextResponse.json({ membres });
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
    const { typeCommission, userId, role, notes } = body;

    if (!typeCommission || !userId) {
      return NextResponse.json({ error: "typeCommission et userId requis" }, { status: 400 });
    }

    const membre = await prisma.membreCommissionRIA.upsert({
      where: { typeCommission_userId: { typeCommission, userId: Number(userId) } },
      create: {
        typeCommission,
        userId: Number(userId),
        role: (role as RoleMembreCommissionRIA) ?? "RAPPORTEUR_2",
        notes,
        actif: true,
      },
      update: {
        role: (role as RoleMembreCommissionRIA) ?? "RAPPORTEUR_2",
        notes,
        actif: true,
        dateSortie: null,
      },
      include: {
        user: { select: { id: true, nom: true, prenom: true, email: true } },
      },
    });

    return NextResponse.json(membre, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
