import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { getOuCreerSocietePrincipale } from "@/lib/comptabilite/societe";

/**
 * GET /api/comptable/societes
 * Sociétés (CDC §50 — architecture multi-sociétés). Une seule société active
 * aujourd'hui (AfriSime SARL) ; l'admin peut en préparer d'autres à l'avance.
 */
export async function GET() {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    await getOuCreerSocietePrincipale(prisma);
    const societes = await prisma.societe.findMany({ orderBy: [{ estPrincipale: "desc" }, { nom: "asc" }] });
    return NextResponse.json({ data: societes });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/societes
 * Body: { nom, pays?, deviseFonctionnelleCode?, referentielComptable?, typeEntite? }
 * Crée une société secondaire (jamais principale via cette route).
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { nom, pays, deviseFonctionnelleCode, referentielComptable, typeEntite } = body as {
      nom?: string; pays?: string; deviseFonctionnelleCode?: string; referentielComptable?: string; typeEntite?: string;
    };
    if (!nom?.trim()) {
      return NextResponse.json({ error: "nom est requis" }, { status: 400 });
    }

    const societe = await prisma.societe.create({
      data: {
        nom: nom.trim(),
        ...(pays !== undefined && { pays }),
        ...(deviseFonctionnelleCode !== undefined && { deviseFonctionnelleCode }),
        ...(referentielComptable !== undefined && { referentielComptable }),
        ...(typeEntite !== undefined && { typeEntite }),
        estPrincipale: false,
      },
    });
    return NextResponse.json({ data: societe }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
