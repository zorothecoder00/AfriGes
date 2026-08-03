import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — libellé et statut actif/inactif (jamais de suppression physique). */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { libelle, actif } = body;

    const updated = await prisma.journalComptable.update({
      where: { id: Number(id) },
      data: {
        ...(libelle !== undefined && { libelle }),
        ...(actif !== undefined && { actif: Boolean(actif) }),
      },
    });
    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
