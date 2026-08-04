import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { listerInventairesAComptabiliser } from "@/lib/comptabilite/ecrituresInventaire";

/** GET /api/comptable/inventaire — inventaires validés en attente de comptabilisation. */
export async function GET() {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const data = await listerInventairesAComptabiliser(prisma);
    return NextResponse.json({ data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
