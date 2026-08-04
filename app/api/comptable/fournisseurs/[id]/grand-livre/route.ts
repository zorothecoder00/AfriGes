import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { genererGrandLivreFournisseur } from "@/lib/comptabilite/clientAuxiliaire";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/comptable/fournisseurs/[id]/grand-livre?dateDebut=&dateFin=
 * Grand livre auxiliaire du fournisseur (CDC §17) : lignes de son compte
 * 401xxx avec solde progressif (montant dû = crédit - débit).
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const dateDebut = searchParams.get("dateDebut") ? new Date(searchParams.get("dateDebut")!) : null;
    const dateFin = searchParams.get("dateFin") ? new Date(`${searchParams.get("dateFin")}T23:59:59`) : null;

    const data = await genererGrandLivreFournisseur(prisma, Number(id), { dateDebut, dateFin });
    return NextResponse.json({ data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
