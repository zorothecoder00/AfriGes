import { NextRequest, NextResponse } from "next/server";
import { Prisma, TypeSortieStock } from "@prisma/client";
import { getAdminSession } from "@/lib/authAdmin";
import { prisma } from "@/lib/prisma";

/**
 * Journal des sorties de stock (admin) — toutes les sorties, y compris celles qui
 * ne génèrent pas de BonSortie (ventes directes, livraisons packs/crédit…).
 * GET /api/admin/stock/journal-sorties?typeSortie=&pointDeVenteId=&debut=YYYY-MM-DD&fin=YYYY-MM-DD&q=&page=&limit=
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 30)));
    const typeSortie = searchParams.get("typeSortie") || "";
    const pdvParam = searchParams.get("pointDeVenteId");
    const debut = searchParams.get("debut");
    const fin = searchParams.get("fin");
    const q = (searchParams.get("q") || "").trim();

    if (typeSortie && !(typeSortie in TypeSortieStock)) {
      return NextResponse.json({ error: "Type de sortie invalide" }, { status: 400 });
    }

    // Filtre commun (sans le type, pour que le récapitulatif par type reste complet).
    const base: Prisma.MouvementStockWhereInput = { type: "SORTIE" };
    if (pdvParam) base.pointDeVenteId = Number(pdvParam);
    if (debut || fin) {
      const plage: Prisma.DateTimeFilter = {};
      if (debut) plage.gte = new Date(`${debut}T00:00:00.000`);
      if (fin) plage.lte = new Date(`${fin}T23:59:59.999`);
      base.dateMouvement = plage;
    }
    if (q) {
      base.OR = [
        { reference: { contains: q, mode: "insensitive" } },
        { motif: { contains: q, mode: "insensitive" } },
        { produit: { nom: { contains: q, mode: "insensitive" } } },
      ];
    }
    const where: Prisma.MouvementStockWhereInput = typeSortie
      ? { ...base, typeSortie: typeSortie as TypeSortieStock }
      : base;

    const [mouvements, total, parType, pdvs] = await Promise.all([
      prisma.mouvementStock.findMany({
        where,
        orderBy: { dateMouvement: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          produit: { select: { id: true, nom: true, reference: true } },
          pointDeVente: { select: { id: true, nom: true, code: true } },
          operateur: { select: { nom: true, prenom: true } },
        },
      }),
      prisma.mouvementStock.count({ where }),
      prisma.mouvementStock.groupBy({ by: ["typeSortie"], where: base, _sum: { quantite: true }, _count: { _all: true } }),
      prisma.pointDeVente.findMany({ where: { actif: true }, select: { id: true, nom: true, code: true }, orderBy: { nom: "asc" } }),
    ]);

    // venteDirecteId / bonSortieId ne sont pas des relations Prisma : résolution manuelle.
    const venteIds = [...new Set(mouvements.map((m) => m.venteDirecteId).filter((v): v is number => v != null))];
    const bonIds = [...new Set(mouvements.map((m) => m.bonSortieId).filter((v): v is number => v != null))];
    const [ventes, bons] = await Promise.all([
      venteIds.length ? prisma.venteDirecte.findMany({ where: { id: { in: venteIds } }, select: { id: true, reference: true } }) : [],
      bonIds.length ? prisma.bonSortie.findMany({ where: { id: { in: bonIds } }, select: { id: true, reference: true } }) : [],
    ]);
    const venteRef = new Map(ventes.map((v) => [v.id, v.reference]));
    const bonRef = new Map(bons.map((b) => [b.id, b.reference]));

    const data = mouvements.map((m) => ({
      id: m.id,
      date: m.dateMouvement,
      reference: m.reference,
      typeSortie: m.typeSortie,
      quantite: m.quantite,
      motif: m.motif,
      produit: m.produit,
      pointDeVente: m.pointDeVente,
      operateur: m.operateur,
      vente: m.venteDirecteId ? { id: m.venteDirecteId, reference: venteRef.get(m.venteDirecteId) ?? null } : null,
      souscriptionId: m.souscriptionId,
      bonSortie: m.bonSortieId ? { id: m.bonSortieId, reference: bonRef.get(m.bonSortieId) ?? null } : null,
    }));

    return NextResponse.json({
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      recap: parType.map((r) => ({ typeSortie: r.typeSortie, nombre: r._count._all, quantite: r._sum.quantite ?? 0 })),
      pdvs,
    });
  } catch (error) {
    console.error("GET /admin/stock/journal-sorties:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
