import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { StatutReunionCommissionRIA } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reunion = await prisma.reunionCommissionRIA.findUnique({
      where: { id: parseInt(id) },
      include: {
        organisateur: { select: { id: true, nom: true, prenom: true } },
        presences: {
          include: {
            membre: {
              include: {
                user: { select: { id: true, nom: true, prenom: true } },
              },
            },
          },
        },
        resolutions: {
          include: {
            responsable: { select: { id: true, nom: true, prenom: true } },
            plansAction: true,
          },
          orderBy: { numero: "asc" },
        },
      },
    });

    if (!reunion) return NextResponse.json({ error: "Réunion introuvable" }, { status: 404 });
    return NextResponse.json(reunion);
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
    const { titre, dateHeure, lieu, ordreJour, statut, compteRendu } = body;

    const reunion = await prisma.reunionCommissionRIA.update({
      where: { id: parseInt(id) },
      data: {
        ...(titre !== undefined ? { titre } : {}),
        ...(dateHeure !== undefined ? { dateHeure: new Date(dateHeure) } : {}),
        ...(lieu !== undefined ? { lieu } : {}),
        ...(ordreJour !== undefined ? { ordreJour } : {}),
        ...(statut !== undefined ? { statut: statut as StatutReunionCommissionRIA } : {}),
        ...(compteRendu !== undefined ? { compteRendu } : {}),
      },
      include: {
        organisateur: { select: { id: true, nom: true, prenom: true } },
      },
    });

    return NextResponse.json(reunion);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
