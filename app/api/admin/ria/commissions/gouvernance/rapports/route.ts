import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { TypeCommissionRIA, TypeRapportCommRIA } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const typeCommission = searchParams.get("typeCommission") as TypeCommissionRIA | null;
    const type           = searchParams.get("type");
    const statut         = searchParams.get("statut");
    const periode        = searchParams.get("periode");

    const rapports = await prisma.rapportCommissionRIA.findMany({
      where: {
        ...(typeCommission ? { typeCommission }                    : {}),
        ...(type           ? { type: type as TypeRapportCommRIA }  : {}),
        ...(statut         ? { statut: statut as never }           : {}),
        ...(periode        ? { periode }                           : {}),
      },
      include: {
        redacteur: { select: { id: true, nom: true, prenom: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ rapports });
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
    const { typeCommission, type, titre, contenu, contenuHtml, periode } = body;

    if (!typeCommission || !type || !titre) {
      return NextResponse.json({ error: "typeCommission, type et titre requis" }, { status: 400 });
    }

    const rapport = await prisma.rapportCommissionRIA.create({
      data: {
        typeCommission: typeCommission as TypeCommissionRIA,
        type:           type as TypeRapportCommRIA,
        titre,
        contenu:    contenu    ?? null,
        contenuHtml: contenuHtml ?? null,
        periode:    periode    ?? null,
        statut:     "BROUILLON",
        redacteurId: parseInt(session.user.id),
      },
      include: {
        redacteur: { select: { id: true, nom: true, prenom: true } },
      },
    });

    return NextResponse.json(rapport, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
