import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { TypeCommissionRIA, NiveauAnomalieCommRIA } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const typeCommission = searchParams.get("typeCommission") as TypeCommissionRIA | null;
    const niveau         = searchParams.get("niveau");
    const resolue        = searchParams.get("resolue");
    const limit          = parseInt(searchParams.get("limit") ?? "100");

    const anomalies = await prisma.anomalieGouvRIA.findMany({
      where: {
        ...(typeCommission ? { typeCommission }                               : {}),
        ...(niveau         ? { niveau: niveau as NiveauAnomalieCommRIA }     : {}),
        ...(resolue        ? { resolue: resolue === "true" }                 : {}),
      },
      include: {
        resoluepar: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: [{ resolue: "asc" }, { niveau: "asc" }, { createdAt: "desc" }],
      take: limit,
    });

    const stats = {
      total:    anomalies.length,
      actives:  anomalies.filter((a) => !a.resolue).length,
      critique: anomalies.filter((a) => !a.resolue && a.niveau === "CRITIQUE").length,
      majeure:  anomalies.filter((a) => !a.resolue && a.niveau === "MAJEURE").length,
      mineure:  anomalies.filter((a) => !a.resolue && a.niveau === "MINEURE").length,
    };

    return NextResponse.json({ anomalies, stats });
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
    const { typeCommission, niveau, titre, description, donnees } = body;

    if (!titre || !description) {
      return NextResponse.json({ error: "titre et description requis" }, { status: 400 });
    }

    const anomalie = await prisma.anomalieGouvRIA.create({
      data: {
        typeCommission: typeCommission ? (typeCommission as TypeCommissionRIA) : null,
        niveau:         (niveau as NiveauAnomalieCommRIA) ?? "MINEURE",
        titre,
        description,
        donnees:        donnees ?? null,
      },
    });

    return NextResponse.json(anomalie, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
