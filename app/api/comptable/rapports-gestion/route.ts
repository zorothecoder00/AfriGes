import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { genererRapportsGestion } from "@/lib/comptabilite/rapportsGestion";

/**
 * GET /api/comptable/rapports-gestion?dateDebut=&dateFin=
 * Rapports de gestion (CDC §71-72) : CA par PDV, marge par produit/famille,
 * rentabilité par agence, rotation de stock, DSO clients, DPO fournisseurs (proxy).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const now = new Date();
    const dateFinStr = req.nextUrl.searchParams.get("dateFin");
    const dateDebutStr = req.nextUrl.searchParams.get("dateDebut");

    const dateFin = dateFinStr ? new Date(dateFinStr + "T23:59:59") : now;
    const dateDebut = dateDebutStr ? new Date(dateDebutStr) : new Date(dateFin.getFullYear(), dateFin.getMonth() - 1, dateFin.getDate());

    const data = await genererRapportsGestion(prisma, dateDebut, dateFin);
    return NextResponse.json({ data, periode: { debut: dateDebut.toISOString(), fin: dateFin.toISOString() } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
