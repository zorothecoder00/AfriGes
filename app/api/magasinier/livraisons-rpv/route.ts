import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";

/**
 * GET /api/magasinier/livraisons-rpv
 * Liste les livraisons RPV EN_COURS à réceptionner physiquement,
 * ainsi que les LIVREE récentes (30j) pour historique.
 */
export async function GET() {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const since30j = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [enCours, livreesRecentes, totalEnCours] = await Promise.all([
      prisma.livraison.findMany({
        where:   { statut: "EN_COURS" },
        orderBy: { datePrevisionnelle: "asc" },
        include: {
          lignes: {
            include: { produit: { select: { id: true, nom: true, stock: true, prixUnitaire: true } } },
          },
        },
      }),
      prisma.livraison.findMany({
        where:   { statut: "LIVREE", dateLivraison: { gte: since30j } },
        orderBy: { dateLivraison: "desc" },
        take:    20,
        include: {
          lignes: {
            include: { produit: { select: { id: true, nom: true } } },
          },
        },
      }),
      prisma.livraison.count({ where: { statut: "EN_COURS" } }),
    ]);

    const serialize = (l: typeof enCours[number]) => ({
      ...l,
      datePrevisionnelle: l.datePrevisionnelle.toISOString(),
      dateLivraison:      l.dateLivraison?.toISOString() ?? null,
      createdAt:          l.createdAt.toISOString(),
      updatedAt:          l.updatedAt.toISOString(),
    });

    return NextResponse.json({
      success: true,
      enCours:         enCours.map(serialize),
      livreesRecentes: livreesRecentes.map(serialize),
      stats: { totalEnCours },
    });
  } catch (error) {
    console.error("GET /api/magasinier/livraisons-rpv error:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}
