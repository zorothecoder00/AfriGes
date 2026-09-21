import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { fichesSansJustificatifs } from "@/lib/ficheDecaissementServer";

/**
 * GET /api/decaissements/justificatifs-manquants
 * Fiches payées du demandeur connecté dont les pièces justificatives ne sont pas encore jointes :
 * tant que la liste n'est pas vide, il ne peut pas créer de nouvelle fiche (l'Admin en est dispensé).
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const admin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const data = admin ? [] : await fichesSansJustificatifs(parseInt(session.user.id));
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /decaissements/justificatifs-manquants:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
