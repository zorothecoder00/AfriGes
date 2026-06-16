import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { StatutResolutionRIA } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const resolution = await prisma.resolutionCommRIA.findUnique({
      where: { id: parseInt(id) },
      include: {
        reunion: { select: { id: true, titre: true, dateHeure: true } },
        responsable: { select: { id: true, nom: true, prenom: true } },
        plansAction: {
          include: {
            responsable: { select: { id: true, nom: true, prenom: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!resolution) return NextResponse.json({ error: "Résolution introuvable" }, { status: 404 });
    return NextResponse.json(resolution);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { statut, titre, description, dateEcheance, responsableId } = body;

    const resolution = await prisma.resolutionCommRIA.update({
      where: { id: parseInt(id) },
      data: {
        ...(statut !== undefined ? { statut: statut as StatutResolutionRIA } : {}),
        ...(titre !== undefined ? { titre } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(dateEcheance !== undefined ? { dateEcheance: dateEcheance ? new Date(dateEcheance) : null } : {}),
        ...(responsableId !== undefined ? { responsableId: responsableId ? Number(responsableId) : null } : {}),
      },
      include: {
        responsable: { select: { id: true, nom: true, prenom: true } },
        plansAction: true,
      },
    });

    return NextResponse.json(resolution);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
