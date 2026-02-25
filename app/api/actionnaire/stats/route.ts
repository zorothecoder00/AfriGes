import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActionnaireSession } from "@/lib/authActionnaire";

/**
 * GET /api/actionnaire/stats
 *
 * Statistiques haute-niveau pour l'actionnaire :
 * - Packs catalogue (total + par type)
 * - Souscriptions (actives, complètes, annulées, montants)
 * - Versements des 30 derniers jours
 * - Snapshot stock
 */
export async function GET() {
  try {
    const session = await getActionnaireSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [packsCount, packsByType, souscriptionsGrouped, versements30j, stockSnapshot] =
      await Promise.all([

        prisma.pack.count(),

        prisma.pack.groupBy({ by: ["type"], _count: { id: true } }),

        prisma.souscriptionPack.groupBy({
          by: ["statut"],
          _count: { id: true },
          _sum: { montantVerse: true, montantRestant: true },
        }),

        prisma.versementPack.aggregate({
          where: { datePaiement: { gte: thirtyDaysAgo } },
          _sum: { montant: true },
          _count: { id: true },
        }),

        prisma.$queryRaw<{ valeur: string; nb: string }[]>`
          SELECT
            COALESCE(SUM(stock * "prixUnitaire"), 0)::text AS valeur,
            COUNT(*)::text AS nb
          FROM "Produit"
        `,
      ]);

    // ── Souscriptions ──────────────────────────────────────────────────────

    const souscActives   = souscriptionsGrouped.find((g) => g.statut === "ACTIF");
    const souscCompletes = souscriptionsGrouped.find((g) => g.statut === "COMPLETE");
    const souscAnnulees  = souscriptionsGrouped.find((g) => g.statut === "ANNULE");
    const montantTotalVerse = souscriptionsGrouped.reduce(
      (s, g) => s + Number(g._sum?.montantVerse ?? 0), 0
    );
    const montantRestant = souscriptionsGrouped.reduce(
      (s, g) => s + Number(g._sum?.montantRestant ?? 0), 0
    );
    const totalSouscriptions = souscriptionsGrouped.reduce((s, g) => s + g._count.id, 0);

    // ── Packs par type ────────────────────────────────────────────────────

    const parType = Object.fromEntries(packsByType.map((g) => [g.type, g._count.id]));

    return NextResponse.json({
      packsStats: {
        total: packsCount,
        parType,
      },
      souscriptionsStats: {
        total: totalSouscriptions,
        actives:   souscActives?._count.id   ?? 0,
        completes: souscCompletes?._count.id ?? 0,
        annulees:  souscAnnulees?._count.id  ?? 0,
        montantTotalVerse,
        montantRestant,
      },
      versementsStats: {
        count30j:  versements30j._count.id,
        montant30j: Number(versements30j._sum.montant ?? 0),
      },
      stockStats: {
        valeurTotale:  Number(stockSnapshot[0]?.valeur ?? 0),
        totalProduits: Number(stockSnapshot[0]?.nb     ?? 0),
      },
    });
  } catch (error) {
    console.error("GET /api/actionnaire/stats", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
