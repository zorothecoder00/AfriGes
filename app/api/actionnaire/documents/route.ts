import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActionnaireSession } from "@/lib/authActionnaire";

/**
 * GET /api/actionnaire/documents
 *
 * Retourne la bibliothèque documentaire accessible à l'actionnaire :
 * - États financiers (bilan, compte de résultat, rapports annuels)
 * - Procès-verbaux des AG
 * - Convocations officielles
 * - Rapports d'audit
 * - Statuts de l'entreprise
 * - Plans stratégiques et autres documents
 */
export async function GET() {
  try {
    const session = await getActionnaireSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const documents = await prisma.documentBibliotheque.findMany({
      where: { estPublic: true },
      orderBy: [{ annee: "desc" }, { createdAt: "desc" }],
    });

    // Grouper par type pour faciliter l'affichage
    const parType: Record<string, typeof documents> = {};
    for (const doc of documents) {
      if (!parType[doc.type]) parType[doc.type] = [];
      parType[doc.type].push(doc);
    }

    return NextResponse.json({ data: documents, parType });
  } catch (error) {
    console.error("GET /api/actionnaire/documents", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
