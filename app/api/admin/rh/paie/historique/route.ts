import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/paie/historique  (CDC 13.9 — Historique des paies)
 * Archive des paies effectuées. Conservation illimitée, aucune suppression.
 *   Query: mois?, annee?, search?, statut? (défaut PAYE), page?, limit?
 * Renvoie les fiches + un indicateur de présence du bulletin signé + stats.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const mois   = searchParams.get("mois");
    const annee  = searchParams.get("annee");
    const search = searchParams.get("search")?.trim() ?? "";
    const statut = searchParams.get("statut") ?? "PAYE";
    const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "30")));
    const skip   = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut !== "TOUS") where.statut = statut;
    if (mois)  where.mois  = Number(mois);
    if (annee) where.annee = Number(annee);
    if (search) {
      where.profilRH = {
        gestionnaire: {
          member: {
            OR: [
              { nom:    { contains: search, mode: "insensitive" } },
              { prenom: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      };
    }

    const [fiches, total, montantAgg] = await Promise.all([
      prisma.fichePaie.findMany({
        where,
        orderBy: [{ annee: "desc" }, { mois: "desc" }, { updatedAt: "desc" }],
        skip,
        take: limit,
        select: {
          id: true, mois: true, annee: true, netAPayer: true, statut: true,
          modePaiement: true, fichierUrl: true, dateMiseEnPaiement: true, updatedAt: true,
          profilRH: {
            select: {
              id: true, matricule: true, departement: true,
              gestionnaire: { select: { member: { select: { nom: true, prenom: true, photo: true } } } },
            },
          },
        },
      }),
      prisma.fichePaie.count({ where }),
      prisma.fichePaie.aggregate({ where, _sum: { netAPayer: true } }),
    ]);

    const avecBulletin = fiches.filter((f) => !!f.fichierUrl).length;

    return NextResponse.json({
      data: fiches,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: {
        montantTotal: Number(montantAgg._sum.netAPayer ?? 0),
        avecBulletin,
        sansBulletin: fiches.length - avecBulletin,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/rh/paie/historique", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
