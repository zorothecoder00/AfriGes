import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

/**
 * GET /api/admin/ria/analyse-mensuelle
 *
 * Scénario d'analyse mensuelle du réseau RIA (calculé « as of » maintenant, libellé
 * au mois courant). Trois volets :
 *   1. Classement des clients par retard      (sain / surveillance / risqué / critique)
 *   2. Aging des créances (encours) par qualité (saines / à risque / douteuses / perdues)
 *   3. Ratios de portefeuille                  (rentabilité / rotation / productivité / utilisation)
 *
 * Seuls les financements affectés (affectationId ≠ null) et non clôturés
 * (ACTIF / EN_RETARD / DEFAUT, encours > 0) entrent dans l'analyse.
 *
 * Seuils de retard (jours) :
 *   Clients   — sain 0 · surveillance 1-6 · risqué 7-30 · critique >30 (DEFAUT = critique)
 *   Créances  — saines 0 · à risque 1-30 · douteuses 31-90 · perdues >90 ou DEFAUT
 */

const DAY = 86_400_000;

type FinRow = {
  statut: string;
  dateEcheance: Date | null;
  encours: unknown;
  clientId: number;
};

export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const now = new Date();
    const toNum = (v: unknown) => Number(v ?? 0);

    const [fins, pfAgg, finAgg] = await Promise.all([
      prisma.operationFinancementRIA.findMany({
        where: { affectationId: { not: null }, statut: { in: ["ACTIF", "EN_RETARD", "DEFAUT"] } },
        select: { statut: true, dateEcheance: true, encours: true, clientId: true },
      }) as unknown as Promise<FinRow[]>,
      prisma.portefeuilleRIA.aggregate({
        _sum: { capitalInvesti: true, capitalEngage: true, beneficesGeneres: true },
      }),
      prisma.operationFinancementRIA.aggregate({
        where: { affectationId: { not: null } },
        _sum: { montantFinance: true, montantRembourse: true },
      }),
    ]);

    // Jours de retard d'un financement (DEFAUT traité comme perte → +∞).
    const joursRetard = (f: FinRow): number => {
      if (f.statut === "DEFAUT") return Number.POSITIVE_INFINITY;
      if (!f.dateEcheance) return 0;
      const d = Math.floor((now.getTime() - new Date(f.dateEcheance).getTime()) / DAY);
      return d > 0 ? d : 0;
    };

    // ── 1. Analyse des clients (par retard max sur leurs financements) ──────────
    const retardParClient = new Map<number, number>();
    for (const f of fins) {
      const r = joursRetard(f);
      const prev = retardParClient.get(f.clientId) ?? 0;
      if (r > prev) retardParClient.set(f.clientId, r);
    }
    const clients = { sains: 0, surveillance: 0, risques: 0, critiques: 0, total: 0 };
    for (const r of retardParClient.values()) {
      clients.total++;
      if (r <= 0)       clients.sains++;
      else if (r < 7)   clients.surveillance++;
      else if (r <= 30) clients.risques++;
      else              clients.critiques++;
    }

    // ── 2. Analyse des créances (encours classé par aging) ──────────────────────
    const creances = {
      saines:    { montant: 0, nb: 0 },
      aRisque:   { montant: 0, nb: 0 },
      douteuses: { montant: 0, nb: 0 },
      perdues:   { montant: 0, nb: 0 },
      total:     0,
    };
    for (const f of fins) {
      const enc = toNum(f.encours);
      if (enc <= 0) continue;
      creances.total += enc;
      const r = joursRetard(f);
      if (f.statut === "DEFAUT" || r > 90) { creances.perdues.montant += enc;   creances.perdues.nb++; }
      else if (r > 30)                     { creances.douteuses.montant += enc; creances.douteuses.nb++; }
      else if (r >= 1)                     { creances.aRisque.montant += enc;   creances.aRisque.nb++; }
      else                                 { creances.saines.montant += enc;    creances.saines.nb++; }
    }

    // ── 3. Analyse du portefeuille (ratios) ─────────────────────────────────────
    const capitalInvesti   = toNum(pfAgg._sum.capitalInvesti);
    const capitalEngage     = toNum(pfAgg._sum.capitalEngage);
    const beneficesGeneres  = toNum(pfAgg._sum.beneficesGeneres);
    const totalFinance      = toNum(finAgg._sum.montantFinance);
    const totalRembourse    = toNum(finAgg._sum.montantRembourse);

    const portefeuille = {
      capitalInvesti, capitalEngage, beneficesGeneres, totalFinance, totalRembourse,
      // Rentabilité = Bénéfices / Capital investi
      rentabilite:     capitalInvesti > 0 ? (beneficesGeneres / capitalInvesti) * 100 : 0,
      // Rotation du capital = nombre de cycles complets (financé / capital investi)
      rotation:        capitalInvesti > 0 ? totalFinance / capitalInvesti : 0,
      // Productivité = Recouvrement / Fonds engagés
      productivite:    capitalEngage > 0 ? (totalRembourse / capitalEngage) * 100 : 0,
      // Taux d'utilisation = Capital engagé / Capital investi
      tauxUtilisation: capitalInvesti > 0 ? (capitalEngage / capitalInvesti) * 100 : 0,
    };

    return NextResponse.json({
      data: {
        mois:    now.getMonth() + 1,
        annee:   now.getFullYear(),
        libelle: now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        clients,
        creances,
        portefeuille,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/analyse-mensuelle", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
