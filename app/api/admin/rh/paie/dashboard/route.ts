import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/paie/dashboard
 * Tableau de bord paie — KPIs masse salariale
 * Query: annee? (défaut: année courante)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const annee = parseInt(searchParams.get("annee") ?? String(new Date().getFullYear()));

    const moisCourant = new Date().getMonth() + 1;

    // ── Masse salariale mensuelle (12 mois de l'année) ─────────────────────────
    const fichesMois = await prisma.fichePaie.groupBy({
      by:     ["mois"],
      where:  { annee, statut: { in: ["PAYE", "EN_PAIEMENT", "VALIDE"] } },
      _sum:   { netAPayer: true, totalBrut: true, totalRetenues: true },
      orderBy: { mois: "asc" },
    });

    const masseMensuelle = Array.from({ length: 12 }, (_, i) => {
      const m = fichesMois.find((f) => f.mois === i + 1);
      return {
        mois:          i + 1,
        netAPayer:     Number(m?._sum.netAPayer  ?? 0),
        totalBrut:     Number(m?._sum.totalBrut  ?? 0),
        totalRetenues: Number(m?._sum.totalRetenues ?? 0),
      };
    });

    // ── KPIs globaux (année) ───────────────────────────────────────────────────
    const [totauxAnnee, statuts, avancesEnCours, pretsEnCours, fichesDuMois] = await Promise.all([
      prisma.fichePaie.aggregate({
        where: { annee, statut: { in: ["PAYE", "EN_PAIEMENT", "VALIDE"] } },
        _sum:  { netAPayer: true, totalBrut: true, totalRetenues: true },
      }),
      prisma.fichePaie.groupBy({
        by:    ["statut"],
        where: { annee },
        _count: { id: true },
      }),
      prisma.avanceSalaire.aggregate({
        where: { statut: "APPROUVE" },
        _sum:  { montantRestant: true },
        _count: { id: true },
      }),
      prisma.pretEmploye.aggregate({
        where: { statut: "EN_COURS" },
        _sum:  { montantRestant: true },
        _count: { id: true },
      }),
      prisma.fichePaie.findMany({
        where:   { annee, mois: moisCourant },
        include: { composants: true },
      }),
    ]);

    // ── Répartition par composant (mois courant) ───────────────────────────────
    const composantsMoisMap: Record<string, number> = {};
    for (const fiche of fichesDuMois) {
      for (const c of fiche.composants) {
        if (!c.isRetenue) {
          composantsMoisMap[c.type] = (composantsMoisMap[c.type] ?? 0) + Number(c.montant);
        }
      }
    }

    // ── Par département (mois courant) ─────────────────────────────────────────
    const fichesDeptMois = await prisma.fichePaie.findMany({
      where:   { annee, mois: moisCourant, statut: { in: ["PAYE", "EN_PAIEMENT", "VALIDE"] } },
      select:  { netAPayer: true, profilRHId: true },
    });

    const profilIds = [...new Set(fichesDeptMois.map((f) => f.profilRHId))];
    const profils   = await prisma.profilRH.findMany({
      where:  { id: { in: profilIds } },
      select: { id: true, departement: true },
    });

    const profilDeptMap = Object.fromEntries(profils.map((p) => [p.id, p.departement ?? "Non défini"]));
    const parDepartement: Record<string, number> = {};
    for (const f of fichesDeptMois) {
      const dept = profilDeptMap[f.profilRHId] ?? "Non défini";
      parDepartement[dept] = (parDepartement[dept] ?? 0) + Number(f.netAPayer);
    }

    const statutsMap = Object.fromEntries(statuts.map((s) => [s.statut, s._count.id]));

    return NextResponse.json({
      data: {
        annee,
        moisCourant,
        masseMensuelle,
        totauxAnnee: {
          netAPayer:     Number(totauxAnnee._sum.netAPayer     ?? 0),
          totalBrut:     Number(totauxAnnee._sum.totalBrut     ?? 0),
          totalRetenues: Number(totauxAnnee._sum.totalRetenues ?? 0),
        },
        statuts:       statutsMap,
        avancesEnCours: {
          count:         avancesEnCours._count.id,
          montantTotal:  Number(avancesEnCours._sum.montantRestant ?? 0),
        },
        pretsEnCours: {
          count:         pretsEnCours._count.id,
          montantTotal:  Number(pretsEnCours._sum.montantRestant ?? 0),
        },
        composantsMoisCourant: composantsMoisMap,
        parDepartement,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/rh/paie/dashboard", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
