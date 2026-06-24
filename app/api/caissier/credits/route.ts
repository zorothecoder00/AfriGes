import { NextResponse } from "next/server";
import { StatutCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";

/**
 * GET /api/caissier/credits
 * Liste les crédits ACTIF ou EN_RETARD des clients rattachés au PDV du caissier.
 * Permet au caissier d'enregistrer un remboursement au comptoir.
 * Query: search, statut, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    if (!isAdmin && !pdvId) {
      return NextResponse.json({ error: "Aucun point de vente associé à ce caissier" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip   = (page - 1) * limit;
    const search = (searchParams.get("search") || "").trim();
    const statut = searchParams.get("statut") as StatutCredit | null;

    const statutsActifs: StatutCredit[] = statut
      ? [statut]
      : [StatutCredit.ACTIF, StatutCredit.EN_RETARD];

    const where = {
      statut:  { in: statutsActifs },
      soldeRestant: { gt: 0 },
      ...(pdvId ? { client: { pointDeVenteId: pdvId } } : {}),
      ...(search
        ? {
            OR: [
              { reference:    { contains: search, mode: "insensitive" as const } },
              { client: { nom:    { contains: search, mode: "insensitive" as const } } },
              { client: { prenom: { contains: search, mode: "insensitive" as const } } },
              { client: { telephone: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [credits, total] = await Promise.all([
      prisma.creditClient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          reference: true,
          statut: true,
          montantTotal: true,
          montantRembourse: true,
          soldeRestant: true,
          montantJournalier: true,
          dateDebut: true,
          dateEcheanceFin: true,
          client: {
            select: {
              id: true, nom: true, prenom: true,
              telephone: true, codeClient: true,
            },
          },
          echeances: {
            where: { statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
            orderBy: { dateEcheance: "asc" },
            take: 1,
            select: { id: true, montantDu: true, montantPaye: true, dateEcheance: true, statut: true },
          },
        },
      }),
      prisma.creditClient.count({ where }),
    ]);

    const data = credits.map((c) => ({
      ...c,
      montantTotal:      Number(c.montantTotal),
      montantRembourse:  Number(c.montantRembourse),
      soldeRestant:      Number(c.soldeRestant),
      montantJournalier: c.montantJournalier ? Number(c.montantJournalier) : null,
      dateDebut:         c.dateDebut.toISOString(),
      dateEcheanceFin:   c.dateEcheanceFin?.toISOString() ?? null,
      prochaineEcheance: c.echeances[0]
        ? {
            id:          c.echeances[0].id,
            montantDu:   Number(c.echeances[0].montantDu),
            montantPaye: Number(c.echeances[0].montantPaye),
            restant:     Number(c.echeances[0].montantDu) - Number(c.echeances[0].montantPaye),
            dateEcheance: c.echeances[0].dateEcheance.toISOString(),
            statut:      c.echeances[0].statut,
          }
        : null,
      echeances: undefined,
    }));

    return NextResponse.json({
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/caissier/credits error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
