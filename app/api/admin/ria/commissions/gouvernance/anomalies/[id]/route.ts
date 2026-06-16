import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { resoudre, titre, description, niveau } = body;

    const data: Record<string, unknown> = {};
    if (titre       !== undefined) data.titre       = titre;
    if (description !== undefined) data.description = description;
    if (niveau      !== undefined) data.niveau      = niveau;

    if (resoudre === true) {
      data.resolue         = true;
      data.dateResolution  = new Date();
      data.resolueParId    = parseInt(session.user.id);
    }

    const anomalie = await prisma.anomalieGouvRIA.update({
      where:   { id: parseInt(id) },
      data,
      include: { resoluepar: { select: { id: true, nom: true, prenom: true } } },
    });

    return NextResponse.json(anomalie);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
