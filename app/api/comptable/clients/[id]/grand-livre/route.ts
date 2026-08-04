import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { genererGrandLivreClient } from "@/lib/comptabilite/clientAuxiliaire";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/comptable/clients/[id]/grand-livre?dateDebut=&dateFin=
 * Grand livre auxiliaire du client (CDC Comptabilité §16) : toutes les lignes
 * de son compte 411xxx, avec solde progressif. `dateDebut` fixe un solde
 * d'ouverture (mouvements antérieurs cumulés) plutôt que de les lister.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const dateDebut = searchParams.get("dateDebut") ? new Date(searchParams.get("dateDebut")!) : null;
    const dateFin = searchParams.get("dateFin") ? new Date(`${searchParams.get("dateFin")}T23:59:59`) : null;

    const data = await genererGrandLivreClient(prisma, Number(id), { dateDebut, dateFin });
    return NextResponse.json({ data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
