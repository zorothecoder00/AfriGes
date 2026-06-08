import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/creances
 * Liste toutes les souscriptions packs avec montantRestant > 0 (créances actives)
 * Query params: page, limit, search, agentId, pdvId, statut, retard (true = échéances en retard)
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page    = Number(searchParams.get("page")  || 1);
    const limit   = Number(searchParams.get("limit") || 20);
    const skip    = (page - 1) * limit;
    const search  = (searchParams.get("search") || "").trim();
    const agentId = searchParams.get("agentId");
    const pdvId   = searchParams.get("pdvId");
    const statut  = searchParams.get("statut"); // ACTIF | EN_ATTENTE | EN_RETARD
    const retard  = searchParams.get("retard") === "true";

    const where: Prisma.SouscriptionPackWhereInput = {
      montantRestant: { gt: 0 },
      statut: { notIn: ["ANNULE", "COMPLETE"] },
      ...(statut && { statut: statut as never }),
      ...(agentId && {
        client: { agentTerrainId: Number(agentId) },
      }),
      ...(pdvId && {
        client: { pointDeVenteId: Number(pdvId) },
      }),
      ...(search && {
        client: {
          OR: [
            { nom:       { contains: search, mode: "insensitive" } },
            { prenom:    { contains: search, mode: "insensitive" } },
            { telephone: { contains: search, mode: "insensitive" } },
            { codeClient:{ contains: search, mode: "insensitive" } },
          ],
        },
      }),
      // Filtre retard : au moins une échéance EN_RETARD ou EN_ATTENTE dont la date est passée
      ...(retard && {
        echeances: {
          some: {
            statut: { in: ["EN_ATTENTE", "EN_RETARD"] },
            datePrevue: { lt: new Date() },
          },
        },
      }),
    };

    const [souscriptions, total, stats] = await Promise.all([
      prisma.souscriptionPack.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          pack: { select: { id: true, nom: true, type: true } },
          client: {
            select: {
              id: true, nom: true, prenom: true, telephone: true,
              codeClient: true, etat: true, segment: true,
              tags: { select: { tag: { select: { id: true, nom: true, couleur: true } } } },
              agentTerrain: { select: { id: true, nom: true, prenom: true } },
              pointDeVente: { select: { id: true, nom: true, code: true } },
            },
          },
          echeances: {
            where: { statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
            orderBy: { datePrevue: "asc" },
            take: 1, // prochaine échéance
          },
          _count: { select: { versements: true, echeances: true } },
        },
      }),
      prisma.souscriptionPack.count({ where }),
      // Stats globales
      prisma.souscriptionPack.aggregate({
        where,
        _sum: { montantRestant: true, montantTotal: true, montantVerse: true },
      }),
    ]);

    // Enrichir avec flag "en retard"
    const now = new Date();
    const data = souscriptions.map((s) => ({
      ...s,
      enRetard: s.echeances.some((e) => new Date(e.datePrevue) < now),
    }));

    return NextResponse.json({
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      stats: {
        totalCreances:      total,
        montantTotalDu:     Number(stats._sum.montantRestant ?? 0),
        montantTotalPacks:  Number(stats._sum.montantTotal   ?? 0),
        montantTotalVerse:  Number(stats._sum.montantVerse   ?? 0),
      },
    });
  } catch (error) {
    console.error("GET /api/admin/creances", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
