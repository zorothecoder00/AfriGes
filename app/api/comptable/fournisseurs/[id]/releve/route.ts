import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { genererGrandLivreFournisseur } from "@/lib/comptabilite/clientAuxiliaire";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/comptable/fournisseurs/[id]/releve?dateDebut=&dateFin=
 * Relevé fournisseur imprimable (CDC §17), symétrique du relevé client (§16).
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const fournisseurId = Number(id);
    const { searchParams } = new URL(req.url);
    const dateDebut = searchParams.get("dateDebut") ? new Date(searchParams.get("dateDebut")!) : null;
    const dateFin = searchParams.get("dateFin") ? new Date(`${searchParams.get("dateFin")}T23:59:59`) : new Date();

    const fournisseur = await prisma.fournisseur.findUnique({
      where: { id: fournisseurId },
      select: { id: true, nom: true, code: true, telephone: true, adresse: true },
    });
    if (!fournisseur) return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });

    const grandLivre = await genererGrandLivreFournisseur(prisma, fournisseurId, { dateDebut, dateFin });

    return NextResponse.json({
      data: { fournisseur, periode: { debut: dateDebut, fin: dateFin }, ...grandLivre },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
