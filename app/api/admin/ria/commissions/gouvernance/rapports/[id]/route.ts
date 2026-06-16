import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { StatutRapportCommRIA } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const rapport = await prisma.rapportCommissionRIA.findUnique({
      where: { id: parseInt(id) },
      include: {
        redacteur: { select: { id: true, nom: true, prenom: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (!rapport) return NextResponse.json({ error: "Rapport introuvable" }, { status: 404 });
    return NextResponse.json(rapport);
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
    const { titre, contenu, contenuHtml, periode, statut } = body;

    const data: Record<string, unknown> = {};
    if (titre       !== undefined) data.titre       = titre;
    if (contenu     !== undefined) data.contenu     = contenu;
    if (contenuHtml !== undefined) data.contenuHtml = contenuHtml;
    if (periode     !== undefined) data.periode     = periode;
    if (statut      !== undefined) {
      data.statut = statut as StatutRapportCommRIA;
      if (statut === "VALIDE") {
        data.valideParId    = parseInt(session.user.id);
        data.dateValidation = new Date();
      }
    }

    const rapport = await prisma.rapportCommissionRIA.update({
      where: { id: parseInt(id) },
      data,
      include: {
        redacteur: { select: { id: true, nom: true, prenom: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
      },
    });

    return NextResponse.json(rapport);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
