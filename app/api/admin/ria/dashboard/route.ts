import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const [
      nbInvestisseurs,
      portefeuilles,
      depots,
      retraits,
      financements,
    ] = await Promise.all([
      prisma.gestionnaire.count({ where: { role: "INVESTISSEUR_RIA" } }),
      prisma.portefeuilleRIA.aggregate({
        _sum: {
          capitalInvesti: true,
          capitalDisponible: true,
          capitalEngage: true,
          capitalRecouvre: true,
          beneficesGeneres: true,
          beneficesDistribues: true,
        },
        _count: { id: true },
      }),
      prisma.depotInvestisseur.groupBy({ by: ["statut"], _sum: { montant: true }, _count: { id: true } }),
      prisma.retraitInvestisseur.groupBy({ by: ["statut"], _sum: { montant: true }, _count: { id: true } }),
      prisma.operationFinancementRIA.groupBy({ by: ["statut"], _sum: { encours: true }, _count: { id: true } }),
    ]);

    const toNum = (v: unknown) => Number(v ?? 0);

    const statsDepots = Object.fromEntries(depots.map((d) => [d.statut, { count: d._count.id, montant: toNum(d._sum.montant) }]));
    const statsRetraits = Object.fromEntries(retraits.map((r) => [r.statut, { count: r._count.id, montant: toNum(r._sum.montant) }]));
    const statsFinancements = Object.fromEntries(financements.map((f) => [f.statut, { count: f._count.id, encours: toNum(f._sum.encours) }]));

    return NextResponse.json({
      data: {
        nbInvestisseurs,
        nbPortefeuilles: portefeuilles._count.id,
        capitalInvesti: toNum(portefeuilles._sum.capitalInvesti),
        capitalDisponible: toNum(portefeuilles._sum.capitalDisponible),
        capitalEngage: toNum(portefeuilles._sum.capitalEngage),
        capitalRecouvre: toNum(portefeuilles._sum.capitalRecouvre),
        beneficesGeneres: toNum(portefeuilles._sum.beneficesGeneres),
        beneficesDistribues: toNum(portefeuilles._sum.beneficesDistribues),
        depots: statsDepots,
        retraits: statsRetraits,
        financements: statsFinancements,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/dashboard", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
