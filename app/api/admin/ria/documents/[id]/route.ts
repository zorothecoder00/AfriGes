import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const doc = await prisma.documentRIAGenere.findUnique({
      where: { id: parseInt(id) },
      include: {
        investisseur: { select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } } },
        portefeuille: { select: { reference: true, nom: true } },
        generePar: { select: { nom: true, prenom: true } },
      },
    });

    if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

    return NextResponse.json({ data: doc });
  } catch (error) {
    console.error("GET /api/admin/ria/documents/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();

    if (body.archive !== undefined) {
      await prisma.documentRIAGenere.update({
        where: { id: parseInt(id) },
        data: { archive: body.archive },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Aucune action valide" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /api/admin/ria/documents/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
