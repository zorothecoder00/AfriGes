import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableLectureSession } from "@/lib/authComptable";
import { genererGrandLivreCompte } from "@/lib/comptabilite/grandLivreBalance";

/**
 * GET /api/comptable/etats-financiers/grand-livre?compteId=&dateDebut=&dateFin=
 * Grand livre réel d'un compte quelconque (CDC §34) — Date, N° pièce, Libellé,
 * Débit, Crédit, Solde progressif, dérivés exclusivement des écritures.
 */
export async function GET(req: Request) {
  try {
    const session = await getComptableLectureSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const compteId = Number(searchParams.get("compteId"));
    if (!compteId) return NextResponse.json({ error: "compteId requis" }, { status: 400 });

    const dateDebut = searchParams.get("dateDebut") ? new Date(searchParams.get("dateDebut")!) : null;
    const dateFin = searchParams.get("dateFin") ? new Date(`${searchParams.get("dateFin")}T23:59:59`) : null;

    // CDC §67 — pagination optionnelle : sans `page`, comportement historique
    // inchangé (toutes les lignes en une réponse).
    const pageParam = searchParams.get("page");
    const page = pageParam ? Math.max(1, Number(pageParam)) : undefined;
    const limit = pageParam ? Math.min(200, Math.max(1, Number(searchParams.get("limit") || 50))) : undefined;

    const data = await genererGrandLivreCompte(prisma, compteId, { dateDebut, dateFin, page, limit });
    return NextResponse.json({ data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
