import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/comptable/fournisseurs/[id]
 * Identité du fournisseur, pour la fiche fournisseur comptable (CDC §17).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const fournisseur = await prisma.fournisseur.findUnique({
      where: { id: Number(id) },
      select: {
        id: true, nom: true, code: true, telephone: true, adresse: true,
        compteAuxiliaire: { select: { numero: true } },
      },
    });
    if (!fournisseur) return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });

    return NextResponse.json({ data: fournisseur });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
