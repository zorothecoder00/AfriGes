import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { verifierReunionExploitable } from "@/lib/authCommissionRIA";
import { TypeCommissionRIA } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const typeCommission = searchParams.get("typeCommission") as TypeCommissionRIA | null;
    const statut = searchParams.get("statut");

    const resolutions = await prisma.resolutionCommRIA.findMany({
      where: {
        ...(typeCommission ? { typeCommission } : {}),
        ...(statut ? { statut: statut as never } : {}),
      },
      include: {
        reunion: { select: { id: true, titre: true, dateHeure: true } },
        responsable: { select: { id: true, nom: true, prenom: true } },
        plansAction: { select: { id: true, statut: true, progression: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ resolutions });
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
    const { typeCommission, reunionId, titre, description, dateEcheance, responsableId } = body;

    if (!typeCommission || !titre) {
      return NextResponse.json({ error: "typeCommission et titre requis" }, { status: 400 });
    }

    // Si rattachée à une réunion, elle doit être cohérente et exploitable (EN_COURS / TENUE).
    if (reunionId) {
      const check = await verifierReunionExploitable(Number(reunionId), typeCommission as TypeCommissionRIA);
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
    }

    // Générer un numéro auto : RES-FINANCE-001, RES-AUDIT-012 …
    const count = await prisma.resolutionCommRIA.count({ where: { typeCommission } });
    const prefix = typeCommission.slice(0, 3).toUpperCase();
    const numero = `RES-${prefix}-${String(count + 1).padStart(3, "0")}`;

    const resolution = await prisma.resolutionCommRIA.create({
      data: {
        typeCommission,
        reunionId: reunionId ? Number(reunionId) : null,
        numero,
        titre,
        description,
        dateEcheance: dateEcheance ? new Date(dateEcheance) : null,
        responsableId: responsableId ? Number(responsableId) : null,
        statut: "EN_PREPARATION", // CDC : une résolution démarre en préparation
      },
      include: {
        responsable: { select: { id: true, nom: true, prenom: true } },
      },
    });

    return NextResponse.json(resolution, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
