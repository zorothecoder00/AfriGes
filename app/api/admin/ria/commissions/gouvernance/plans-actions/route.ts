import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { TypeCommissionRIA, PrioriteActionRIA } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const typeCommission = searchParams.get("typeCommission") as TypeCommissionRIA | null;
    const statut = searchParams.get("statut");
    const priorite = searchParams.get("priorite");

    const plans = await prisma.planActionCommRIA.findMany({
      where: {
        ...(typeCommission ? { typeCommission } : {}),
        ...(statut ? { statut: statut as never } : {}),
        ...(priorite ? { priorite: priorite as PrioriteActionRIA } : {}),
      },
      include: {
        resolution: { select: { id: true, numero: true, titre: true } },
        responsable: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: [{ priorite: "asc" }, { dateEcheance: "asc" }],
    });

    return NextResponse.json({ plans });
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
    const { typeCommission, resolutionId, titre, description, priorite, responsableId, dateDebut, dateEcheance } = body;

    if (!typeCommission || !titre) {
      return NextResponse.json({ error: "typeCommission et titre requis" }, { status: 400 });
    }

    const plan = await prisma.planActionCommRIA.create({
      data: {
        typeCommission,
        resolutionId: resolutionId ? Number(resolutionId) : null,
        titre,
        description,
        priorite: (priorite as PrioriteActionRIA) ?? "MOYENNE",
        statut: "A_FAIRE",
        responsableId: responsableId ? Number(responsableId) : null,
        dateDebut: dateDebut ? new Date(dateDebut) : null,
        dateEcheance: dateEcheance ? new Date(dateEcheance) : null,
        progression: 0,
      },
      include: {
        responsable: { select: { id: true, nom: true, prenom: true } },
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
