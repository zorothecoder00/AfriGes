import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";

/** "Bon de remplacement" (CDC §5.8) — file d'attente du magasinier. */
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

    const remplacements = await prisma.remplacementProduit.findMany({
      where,
      include: {
        produitOrigine: { select: { id: true, nom: true, codeProduit: true } },
        produitRemplacement: { select: { id: true, nom: true, codeProduit: true } },
        reclamation: { select: { id: true, numero: true, client: { select: { nom: true, prenom: true } } } },
        magasinier: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: remplacements });
  } catch (error) {
    console.error("GET /magasinier/remplacements:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
