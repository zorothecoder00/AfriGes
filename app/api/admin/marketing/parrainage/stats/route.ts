import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

const VENTES_EXCLUES = ["ANNULEE", "BROUILLON"];

/**
 * GET /api/admin/marketing/parrainage/stats — suivi agrégé du programme (CDC §38 :
 * coût / nouveaux clients / CA généré / ROI). Le "coût" est exprimé en points
 * fidélité attribués (pas de taux de conversion point→FCFA dans ce système —
 * inventer un taux serait trompeur) ; le ROI est donc présenté comme un ratio
 * CA généré / point investi plutôt qu'un pourcentage classique.
 */
export async function GET() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const [parEnAttente, parQualifies, parRecompenses, pointsAgg] = await Promise.all([
      prisma.parrainage.count({ where: { statut: "EN_ATTENTE" } }),
      prisma.parrainage.count({ where: { statut: "QUALIFIE" } }),
      prisma.parrainage.count({ where: { statut: "RECOMPENSE" } }),
      prisma.transactionFidelite.aggregate({ where: { source: "PARRAINAGE" }, _sum: { points: true } }),
    ]);

    const filleulsConvertis = await prisma.parrainage.findMany({
      where: { statut: { in: ["QUALIFIE", "RECOMPENSE"] } },
      select: { filleulId: true, dateQualification: true },
    });

    let caGenere = 0;
    if (filleulsConvertis.length > 0) {
      const ventes = await Promise.all(
        filleulsConvertis.map((f) =>
          prisma.venteDirecte.aggregate({
            where: {
              clientId: f.filleulId,
              statut: { notIn: VENTES_EXCLUES as never },
              ...(f.dateQualification ? { createdAt: { gte: f.dateQualification } } : {}),
            },
            _sum: { montantTotal: true },
          })
        )
      );
      caGenere = ventes.reduce((acc, v) => acc + Number(v._sum.montantTotal ?? 0), 0);
    }

    const coutPoints = pointsAgg._sum.points ?? 0;
    const nouveauxClients = filleulsConvertis.length;
    const caParPoint = coutPoints > 0 ? caGenere / coutPoints : null;

    return NextResponse.json({
      data: {
        totalParrainages: parEnAttente + parQualifies + parRecompenses,
        enAttente: parEnAttente, qualifies: parQualifies, recompenses: parRecompenses,
        nouveauxClients, coutPoints, caGenere, caParPoint,
      },
    });
  } catch (e) {
    console.error("GET /api/admin/marketing/parrainage/stats", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
