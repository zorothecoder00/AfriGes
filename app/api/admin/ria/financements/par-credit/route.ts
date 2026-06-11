import { NextRequest, NextResponse } from "next/server";
import { StatutCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut") ?? "";
    const search = searchParams.get("search") ?? "";

    const credits = await prisma.creditClient.findMany({
      where: {
        financementsRIA: { some: { statut: { not: "ANNULE" } } },
        ...(statut ? { statut: statut as StatutCredit } : {}),
        ...(search
          ? {
              OR: [
                { reference: { contains: search, mode: "insensitive" } },
                { client: { nom:    { contains: search, mode: "insensitive" } } },
                { client: { prenom: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        financementsRIA: {
          where: { statut: { not: "ANNULE" } },
          include: {
            portefeuille: {
              select: {
                id: true, reference: true, nom: true,
                profilRIA: {
                  select: {
                    gestionnaire: {
                      select: { member: { select: { nom: true, prenom: true } } },
                    },
                  },
                },
              },
            },
            affectation: { select: { pourcentage: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const items = credits.map((c) => {
      const fins = c.financementsRIA;
      const totalFinanceRIA   = fins.reduce((s, f) => s + Number(f.montantFinance),   0);
      const totalRembourseRIA = fins.reduce((s, f) => s + Number(f.montantRembourse), 0);
      const totalEncoursRIA   = fins.reduce((s, f) => s + Number(f.encours),          0);
      const nbPortefeuilles   = new Set(fins.map((f) => f.portefeuilleId)).size;
      const tauxRecouvrement  = totalFinanceRIA > 0 ? (totalRembourseRIA / totalFinanceRIA) * 100 : 0;

      return {
        creditId:         c.id,
        creditReference:  c.reference,
        creditStatut:     c.statut,
        montantTotal:     Number(c.montantTotal),
        montantRembourse: Number(c.montantRembourse),
        soldeRestant:     Number(c.soldeRestant),
        dateEcheanceFin:  c.dateEcheanceFin,
        client:           c.client,
        financementsRIA: fins.map((f) => ({
          id:               f.id,
          reference:        f.reference,
          statut:           f.statut,
          montantFinance:   Number(f.montantFinance),
          montantRembourse: Number(f.montantRembourse),
          encours:          Number(f.encours),
          pourcentage:      f.affectation ? Number(f.affectation.pourcentage) : null,
          portefeuille: {
            id:             f.portefeuille.id,
            reference:      f.portefeuille.reference,
            nom:            f.portefeuille.nom,
            investisseurNom: f.portefeuille.profilRIA
              ? `${f.portefeuille.profilRIA.gestionnaire.member.prenom} ${f.portefeuille.profilRIA.gestionnaire.member.nom}`
              : "—",
          },
        })),
        totalFinanceRIA,
        totalRembourseRIA,
        totalEncoursRIA,
        nbPortefeuilles,
        tauxRecouvrement,
      };
    });

    const globalStats = {
      totalCredits:       items.length,
      totalFinanceRIA:    items.reduce((s, c) => s + c.totalFinanceRIA,    0),
      totalEncoursRIA:    items.reduce((s, c) => s + c.totalEncoursRIA,    0),
      totalRembourseRIA:  items.reduce((s, c) => s + c.totalRembourseRIA,  0),
      tauxRecouvrement:   0,
    };
    if (globalStats.totalFinanceRIA > 0) {
      globalStats.tauxRecouvrement =
        (globalStats.totalRembourseRIA / globalStats.totalFinanceRIA) * 100;
    }

    return NextResponse.json({ data: items, stats: globalStats });
  } catch (error) {
    console.error("GET /api/admin/ria/financements/par-credit", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
