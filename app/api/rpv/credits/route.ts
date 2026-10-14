import { NextResponse } from "next/server";
import { Prisma, StatutCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { resolveUserPdvs } from "@/lib/userPdv";
import { conditionsNomPrenom } from "@/lib/clientNameSearch";

/**
 * GET /api/rpv/credits
 * Crédits clients du point de vente du RPV (Admin : tout le réseau), pour la
 * correction des erreurs de saisie (modifier / supprimer crédit ou remboursement
 * via /api/admin/credits/[id]/**, ouverts au RPV sur son périmètre).
 * Filtres : search (référence, nom, téléphone), statut, page, limit.
 */
export async function GET(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    let pdvIds: number[] | null = null;
    if (!isAdmin) {
      pdvIds = (await resolveUserPdvs(parseInt(session.user.id))).map((p) => p.id);
      if (pdvIds.length === 0) return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const search = (searchParams.get("search") || "").trim();
    const statut = searchParams.get("statut");

    const where: Prisma.CreditClientWhereInput = {
      ...(pdvIds && { pointDeVenteId: { in: pdvIds } }),
      ...(statut && Object.values(StatutCredit).includes(statut as StatutCredit) && { statut: statut as StatutCredit }),
      ...(search && {
        OR: [
          { reference: { contains: search, mode: "insensitive" } },
          { client: { OR: [...conditionsNomPrenom(search), { telephone: { contains: search, mode: "insensitive" } }] } },
        ],
      }),
    };

    const [credits, total] = await Promise.all([
      prisma.creditClient.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, reference: true, statut: true,
          montantTotal: true, montantInteret: true, montantRembourse: true, soldeRestant: true,
          dureeJours: true, dateDebut: true, createdAt: true,
          client: { select: { id: true, nom: true, prenom: true, codeClient: true, telephone: true } },
          _count: { select: { remboursements: true } },
        },
      }),
      prisma.creditClient.count({ where }),
    ]);

    return NextResponse.json({ data: credits, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("GET /api/rpv/credits", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
