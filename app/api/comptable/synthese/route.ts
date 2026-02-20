import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

/**
 * GET /api/comptable/synthese?period=7|30|90|365
 *
 * Retourne la synthèse financière de la période :
 * - Encaissements (ventes, cotisations, contributions tontines, remboursements crédits)
 * - Décaissements (approvisionnements, crédits décaissés, pots tontines versés)
 * - Résultat net
 * - Évolution jour par jour
 * - Snapshot stock + compteurs
 */
export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const periodParam = Number(searchParams.get("period") ?? "30");
    const period = [7, 30, 90, 365].includes(periodParam) ? periodParam : 30;

    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - period);

    // ── Agrégats en parallèle ─────────────────────────────────────────────────

    const [
      ventesTotaux,
      cotisationsTotaux,
      contribsTotaux,
      rembCredits,
      approTotaux,
      creditsDecaisses,
      potsTontines,
      stockSnapshot,
      membresActifs,
      tontinesActives,
      creditsEnCours,
    ] = await Promise.all([

      // ── ENCAISSEMENTS ─────────────────────────────────────────────────────

      // 1. Ventes (crédit alimentaire)
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT
          COALESCE(SUM(quantite * "prixUnitaire"), 0)::text AS total,
          COUNT(*)::text AS cnt
        FROM "VenteCreditAlimentaire"
        WHERE "createdAt" >= ${since}
      `,

      // 2. Cotisations payées
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT
          COALESCE(SUM(montant), 0)::text AS total,
          COUNT(*)::text AS cnt
        FROM "Cotisation"
        WHERE statut = 'PAYEE' AND "datePaiement" >= ${since}
      `,

      // 3. Contributions tontines payées
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT
          COALESCE(SUM(montant), 0)::text AS total,
          COUNT(*)::text AS cnt
        FROM "TontineContribution"
        WHERE statut = 'PAYEE' AND "datePaiement" >= ${since}
      `,

      // 4. Remboursements crédits reçus
      prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(montant), 0)::text AS total
        FROM "CreditTransaction"
        WHERE type = 'REMBOURSEMENT' AND "createdAt" >= ${since}
      `,

      // ── DÉCAISSEMENTS ─────────────────────────────────────────────────────

      // 5. Approvisionnements (mouvements ENTREE, coût = quantite × prixUnitaire produit)
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT
          COALESCE(SUM(m.quantite * p."prixUnitaire"), 0)::text AS total,
          COUNT(*)::text AS cnt
        FROM "MouvementStock" m
        JOIN "Produit" p ON p.id = m."produitId"
        WHERE m.type = 'ENTREE' AND m."dateMouvement" >= ${since}
      `,

      // 6. Crédits décaissés (déblocage de crédit)
      prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(montant), 0)::text AS total
        FROM "CreditTransaction"
        WHERE type = 'DECAISSEMENT' AND "createdAt" >= ${since}
      `,

      // 7. Pots tontines versés aux bénéficiaires
      prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM("montantPot"), 0)::text AS total
        FROM "TontineCycle"
        WHERE statut = 'COMPLETE' AND "dateCloture" >= ${since}
      `,

      // ── SNAPSHOT ──────────────────────────────────────────────────────────

      // 8. Valeur du stock actuel
      prisma.$queryRaw<{ valeur: string; nb: string }[]>`
        SELECT
          COALESCE(SUM(stock * "prixUnitaire"), 0)::text AS valeur,
          COUNT(*)::text AS nb
        FROM "Produit"
      `,

      // 9–11. Compteurs
      prisma.user.count({ where: { etat: "ACTIF" } }),
      prisma.tontine.count({ where: { statut: "ACTIVE" } }),
      prisma.credit.count({
        where: { statut: { in: ["EN_ATTENTE", "APPROUVE", "REMBOURSE_PARTIEL"] } },
      }),
    ]);

    // ── Évolution jour par jour ────────────────────────────────────────────────

    const [ventesJour, cotisJour, contribJour, approJour] = await Promise.all([
      prisma.venteCreditAlimentaire.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, quantite: true, prixUnitaire: true },
      }),
      prisma.cotisation.findMany({
        where: { statut: "PAYEE", datePaiement: { gte: since } },
        select: { datePaiement: true, montant: true },
      }),
      prisma.tontineContribution.findMany({
        where: { statut: "PAYEE", datePaiement: { gte: since } },
        select: { datePaiement: true, montant: true },
      }),
      prisma.mouvementStock.findMany({
        where: { type: "ENTREE", dateMouvement: { gte: since } },
        select: {
          dateMouvement: true,
          quantite: true,
          produit: { select: { prixUnitaire: true } },
        },
      }),
    ]);

    const encaisMap: Record<string, number> = {};
    const decaisMap: Record<string, number> = {};

    for (const v of ventesJour) {
      const k = v.createdAt.toISOString().split("T")[0];
      encaisMap[k] = (encaisMap[k] ?? 0) + v.quantite * Number(v.prixUnitaire);
    }
    for (const c of cotisJour) {
      if (!c.datePaiement) continue;
      const k = c.datePaiement.toISOString().split("T")[0];
      encaisMap[k] = (encaisMap[k] ?? 0) + Number(c.montant);
    }
    for (const c of contribJour) {
      if (!c.datePaiement) continue;
      const k = c.datePaiement.toISOString().split("T")[0];
      encaisMap[k] = (encaisMap[k] ?? 0) + Number(c.montant);
    }
    for (const m of approJour) {
      const k = m.dateMouvement.toISOString().split("T")[0];
      decaisMap[k] = (decaisMap[k] ?? 0) + m.quantite * Number(m.produit.prixUnitaire);
    }

    const evolution: { date: string; encaissements: number; decaissements: number }[] = [];
    for (let i = period; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const k = d.toISOString().split("T")[0];
      evolution.push({
        date: k,
        encaissements: encaisMap[k] ?? 0,
        decaissements: decaisMap[k] ?? 0,
      });
    }

    // ── Totaux ────────────────────────────────────────────────────────────────

    // Ventes via crédit alimentaire : flux opérationnel (pas de cash réel reçu)
    const ventesVolume       = Number(ventesTotaux[0].total);
    const ventesCount        = Number(ventesTotaux[0].cnt);

    // Encaissements réels (cash entrant)
    const encaisCotisations  = Number(cotisationsTotaux[0].total);
    const encaisContribs     = Number(contribsTotaux[0].total);
    const encaisRemb         = Number(rembCredits[0].total);
    const totalEncaissements = encaisCotisations + encaisContribs + encaisRemb;

    const decaisAppro        = Number(approTotaux[0].total);
    const decaisCredits      = Number(creditsDecaisses[0].total);
    const decaisPots         = Number(potsTontines[0].total);
    const totalDecaissements = decaisAppro + decaisCredits + decaisPots;

    return NextResponse.json({
      success: true,
      data: {
        periode: { debut: since.toISOString(), fin: now.toISOString(), jours: period },
        // Encaissements = cash réellement reçu (cotisations, contributions, remboursements)
        encaissements: {
          cotisations:            { montant: encaisCotisations, count: Number(cotisationsTotaux[0].cnt) },
          contributions_tontines: { montant: encaisContribs,    count: Number(contribsTotaux[0].cnt) },
          remboursements_credits: { montant: encaisRemb },
          total: totalEncaissements,
        },
        // Activité produits = ventes via crédit alim (consommation de crédits pré-financés)
        activiteProduits: {
          ventes: { montant: ventesVolume, count: ventesCount },
        },
        decaissements: {
          approvisionnements: { montant: decaisAppro,   count: Number(approTotaux[0].cnt) },
          credits_decaisses:  { montant: decaisCredits },
          pots_tontines:      { montant: decaisPots },
          total: totalDecaissements,
        },
        resultat_net: totalEncaissements - totalDecaissements,
        taux_utilisation: totalEncaissements > 0
          ? Math.round((totalDecaissements / totalEncaissements) * 100)
          : 0,
        evolution,
        snapshot: {
          stock:         { valeur: Number(stockSnapshot[0].valeur), nombreProduits: Number(stockSnapshot[0].nb) },
          membresActifs,
          tontinesActives,
          creditsEnCours,
        },
      },
    });
  } catch (error) {
    console.error("COMPTABLE SYNTHESE ERROR:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
