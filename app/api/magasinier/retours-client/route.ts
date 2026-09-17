import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";

/**
 * "Fiche de retour marchandise" / "Bon de retour" (CDC §5.8) — file d'attente
 * du magasinier : retours déclarés par le Service Commercial à réceptionner
 * puis valider (génère l'entrée de stock RETOUR_CLIENT).
 */
export async function GET(req: Request) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = Number(session.user.id);
    const where: Record<string, unknown> = {};
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      const aff = await prisma.gestionnaireAffectation.findFirst({ where: { userId, actif: true }, select: { pointDeVenteId: true } });
      if (!aff?.pointDeVenteId) return NextResponse.json({ data: [] });
      where.pointDeVenteId = aff.pointDeVenteId;
    }

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    if (statut) where.statut = statut;

    const retours = await prisma.retourMarchandiseClient.findMany({
      where,
      include: {
        lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true } } } },
        reclamation: { select: { id: true, numero: true, objet: true, client: { select: { nom: true, prenom: true } } } },
        magasinier: { select: { id: true, nom: true, prenom: true } },
        pointDeVente: { select: { id: true, nom: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: retours });
  } catch (error) {
    console.error("GET /magasinier/retours-client:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
