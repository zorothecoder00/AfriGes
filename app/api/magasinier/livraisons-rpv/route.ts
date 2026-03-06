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

    // Auto-détecter le PDV du magasinier
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: parseInt(session.user.id), actif: true },
      select: { pointDeVenteId: true },
    });
    const pdvFilter = aff ? { pointDeVenteId: aff.pointDeVenteId } : {};

    const [enCours, recuesRecentes, totalEnCours] = await Promise.all([
      prisma.receptionApprovisionnement.findMany({
        where:   { ...pdvFilter, statut: "EN_COURS" },
        orderBy: { datePrevisionnelle: "asc" },
        include: {
          lignes: {
            include: { produit: { select: { id: true, nom: true, prixUnitaire: true } } },
          },
        },
      }),
      prisma.receptionApprovisionnement.findMany({
        where:   { ...pdvFilter, statut: { in: ["RECU", "VALIDE"] }, dateReception: { gte: since30j } },
        orderBy: { dateReception: "desc" },
        take:    20,
        include: {
          lignes: {
            include: { produit: { select: { id: true, nom: true } } },
          },
        },
      }),
      prisma.receptionApprovisionnement.count({ where: { ...pdvFilter, statut: "EN_COURS" } }),
    ]);

    type Reception = typeof enCours[number];
    const serialize = (r: Reception) => ({
      ...r,
      datePrevisionnelle: r.datePrevisionnelle.toISOString(),
      dateReception:      r.dateReception?.toISOString() ?? null,
      createdAt:          r.createdAt.toISOString(),
      updatedAt:          r.updatedAt.toISOString(),
    });

    return NextResponse.json({
      success: true,
      enCours:        enCours.map(serialize),
      recuesRecentes: recuesRecentes.map(serialize),
      stats: { totalEnCours },
    });
  } catch (error) {
    console.error("GET /api/magasinier/livraisons-rpv error:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}
