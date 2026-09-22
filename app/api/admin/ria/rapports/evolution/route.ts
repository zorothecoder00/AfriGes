import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { dansFenetreAffectation } from "@/lib/riaAffectation";

/**
 * ==========================
 * GET /api/admin/ria/rapports/evolution
 * ==========================
 * Série mensuelle globale (tous portefeuilles) du recouvrement RIA : financé
 * cumulé, payé (mois + cumulé), restant (encours) et taux de recouvrement,
 * sur les N derniers mois (défaut 12, ?mois=N). Consommée par le dashboard
 * admin RIA et son miroir ResponsableRIA (même route, pas de duplication).
 *
 * Remboursements bornés à la fenêtre d'affectation client→investisseur
 * (lib/riaAffectation.ts) — même règle que /api/admin/ria/rapports/generer.
 */

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export async function GET(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const nbMois = Math.min(36, Math.max(1, Number(searchParams.get("mois") || 12)));

    const toN = (v: unknown) => Number(v ?? 0);

    const financements = await prisma.operationFinancementRIA.findMany({
      where: { affectationId: { not: null } },
      select: {
        montantFinance: true,
        dateFinancement: true,
        affectation: { select: { dateDebut: true, dateFin: true } },
        remboursements: { select: { montant: true, createdAt: true } },
      },
    });

    // Bâtir les N derniers mois (clé "YYYY-MM"), du plus ancien au plus récent.
    const now = new Date();
    const mois: { key: string; label: string; finMois: Date }[] = [];
    for (let i = nbMois - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const finMois = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      mois.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${MOIS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        finMois,
      });
    }

    // Montant remboursé (borné à la fenêtre d'affectation) par mois — clé "YYYY-MM".
    const rembParMois = new Map<string, number>();
    for (const f of financements) {
      for (const r of f.remboursements) {
        const d = new Date(r.createdAt);
        if (!dansFenetreAffectation(f.affectation, d)) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        rembParMois.set(key, (rembParMois.get(key) ?? 0) + toN(r.montant));
      }
    }

    // Financé cumulé mois par mois — via un pointeur sur les financements triés
    // par date (les mois sont déjà en ordre croissant).
    const sortedFinancements = [...financements].sort(
      (a, b) => (a.dateFinancement?.getTime() ?? 0) - (b.dateFinancement?.getTime() ?? 0)
    );
    let idx = 0;
    let financeCumule = 0;
    let payeCumule = 0;

    const evolution = mois.map((m) => {
      while (
        idx < sortedFinancements.length &&
        sortedFinancements[idx].dateFinancement &&
        sortedFinancements[idx].dateFinancement!.getTime() <= m.finMois.getTime()
      ) {
        financeCumule += toN(sortedFinancements[idx].montantFinance);
        idx++;
      }
      const paye = rembParMois.get(m.key) ?? 0;
      payeCumule += paye;
      const restant = Math.max(0, financeCumule - payeCumule);
      const tauxRecouvrement = financeCumule > 0 ? (payeCumule / financeCumule) * 100 : 0;

      return {
        mois: m.key,
        label: m.label,
        finance: financeCumule,
        paye,
        payeCumule,
        restant,
        tauxRecouvrement: parseFloat(tauxRecouvrement.toFixed(2)),
      };
    });

    return NextResponse.json({ data: evolution });
  } catch (error) {
    console.error("GET /api/admin/ria/rapports/evolution", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
