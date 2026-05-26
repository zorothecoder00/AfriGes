import { NextResponse } from "next/server";
import { Prisma, StatutCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getComptableSession, getComptablePdvId } from "@/lib/authComptable";
import { resolveViewAs } from "@/lib/viewAs";

/**
 * GET /api/comptable/balance-clients
 *
 * Pour chaque client ayant au moins un crédit :
 *   - limiteCredit (plafond autorisé)
 *   - soldeActuel (dettes en cours = total non remboursé)
 *   - totalCreditsAccordes (montant total de tous les crédits accordés)
 *   - totalRembourse (total des remboursements reçus)
 *   - nbCreditsActifs (ACTIF + EN_RETARD)
 *   - nbCreditsEnRetard
 *   - tauxRecouvrement (%)
 *   - niveauRisque / scoreSolvabilite
 *
 * Query: search, statut (ACTIF|EN_RETARD|SOLDE|tous), pdvId, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const viewAs  = isAdmin ? resolveViewAs(req as Parameters<typeof resolveViewAs>[0]) : null;
    const pdvId   = await getComptablePdvId(session, viewAs?.userId);

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 30)));
    const skip   = (page - 1) * limit;
    const search = (searchParams.get("search") || "").trim();
    const statutFilter = searchParams.get("statut") || "actifs"; // actifs | retard | tous

    // Filtre sur statut des crédits
    const statutsCredits: StatutCredit[] =
      statutFilter === "retard" ? [StatutCredit.EN_RETARD] :
      statutFilter === "tous"   ? [StatutCredit.ACTIF, StatutCredit.EN_RETARD, StatutCredit.SOLDE] :
      [StatutCredit.ACTIF, StatutCredit.EN_RETARD];

    const where: Prisma.ClientWhereInput = {
      creditsClients: { some: { statut: { in: statutsCredits } } },
      ...(pdvId ? { pointDeVenteId: pdvId } : {}),
      ...(search
        ? {
            OR: [
              { nom:       { contains: search, mode: "insensitive" } },
              { prenom:    { contains: search, mode: "insensitive" } },
              { telephone: { contains: search, mode: "insensitive" } },
              { codeClient:{ contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { soldeActuel: "desc" },
        select: {
          id: true,
          codeClient: true,
          nom: true,
          prenom: true,
          telephone: true,
          niveauRisque: true,
          scoreSolvabilite: true,
          limiteCredit: true,
          soldeActuel: true,
          pointDeVente: { select: { nom: true, code: true } },
          agentTerrain: { select: { nom: true, prenom: true } },
          creditsClients: {
            where: { statut: { in: statutsCredits } },
            select: {
              id: true,
              statut: true,
              montantTotal: true,
              soldeRestant: true,
              montantRembourse: true,
              dateDebut: true,
              dateEcheanceFin: true,
            },
          },
        },
      }),
      prisma.client.count({ where }),
    ]);

    // ── Totaux globaux pour les stats d'en-tête ───────────────────────────────
    const pdvCreditJoin   = pdvId !== null ? Prisma.sql`JOIN "Client" cli ON cli.id = cr."clientId"` : Prisma.empty;
    const pdvCreditFilter = pdvId !== null ? Prisma.sql`AND cli."pointDeVenteId" = ${pdvId}` : Prisma.empty;

    const [globalStats] = await prisma.$queryRaw<{
      total_accorde: string;
      total_rembourse: string;
      total_solde_restant: string;
      nb_actifs: string;
      nb_retard: string;
    }[]>`
      SELECT
        COALESCE(SUM(cr."montantTotal"), 0)::text       AS total_accorde,
        COALESCE(SUM(cr."montantRembourse"), 0)::text   AS total_rembourse,
        COALESCE(SUM(cr."soldeRestant"), 0)::text       AS total_solde_restant,
        COUNT(*) FILTER (WHERE cr.statut = 'ACTIF')::text      AS nb_actifs,
        COUNT(*) FILTER (WHERE cr.statut = 'EN_RETARD')::text  AS nb_retard
      FROM "CreditClient" cr
      ${pdvCreditJoin}
      WHERE cr.statut IN ('ACTIF', 'EN_RETARD')
      ${pdvCreditFilter}
    `;

    // ── Construction de la réponse par client ─────────────────────────────────
    const data = clients.map((c) => {
      const credits        = c.creditsClients;
      const totalAccorde   = credits.reduce((s, cr) => s + Number(cr.montantTotal), 0);
      const totalRembourse = credits.reduce((s, cr) => s + Number(cr.montantRembourse), 0);
      const soldeRestant   = credits.reduce((s, cr) => s + Number(cr.soldeRestant), 0);
      const nbActifs       = credits.filter((cr) => cr.statut === "ACTIF").length;
      const nbRetard       = credits.filter((cr) => cr.statut === "EN_RETARD").length;
      const tauxRecouvrement = totalAccorde > 0
        ? Math.round((totalRembourse / totalAccorde) * 100)
        : 0;

      return {
        id:              c.id,
        codeClient:      c.codeClient,
        nom:             c.nom,
        prenom:          c.prenom,
        telephone:       c.telephone,
        niveauRisque:    c.niveauRisque,
        scoreSolvabilite: c.scoreSolvabilite,
        limiteCredit:    c.limiteCredit ? Number(c.limiteCredit) : null,
        soldeActuel:     Number(c.soldeActuel ?? 0),
        pointDeVente:    c.pointDeVente,
        agentTerrain:    c.agentTerrain,
        credits: {
          total:           credits.length,
          nbActifs,
          nbRetard,
          totalAccorde,
          totalRembourse,
          soldeRestant,
          tauxRecouvrement,
        },
      };
    });

    return NextResponse.json({
      data,
      stats: {
        totalAccorde:    Number(globalStats?.total_accorde    ?? 0),
        totalRembourse:  Number(globalStats?.total_rembourse  ?? 0),
        soldeRestant:    Number(globalStats?.total_solde_restant ?? 0),
        nbCreditsActifs: Number(globalStats?.nb_actifs ?? 0),
        nbCreditsRetard: Number(globalStats?.nb_retard ?? 0),
        tauxRecouvrement: Number(globalStats?.total_accorde ?? 0) > 0
          ? Math.round((Number(globalStats?.total_rembourse ?? 0) / Number(globalStats?.total_accorde ?? 0)) * 100)
          : 0,
      },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/comptable/balance-clients error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
