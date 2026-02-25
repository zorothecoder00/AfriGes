import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

/**
 * GET /api/comptable/etats-financiers
 *
 * Retourne (basé sur l'architecture packs) :
 * - Bilan simplifié (Actif / Passif snapshot à aujourd'hui)
 * - Compte de résultat (Produits / Charges depuis le 1er janvier)
 * - Ratios financiers
 */
export async function GET() {
  try {
    const session = await getComptableSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const now       = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [
      stockValeur,
      creancesPacks,
      produitsVersements,
      chargesAppro,
      souscriptionsStats,
    ] = await Promise.all([

      // 1. Valeur du stock (actif)
      prisma.$queryRaw<{ valeur: string; nb: string }[]>`
        SELECT
          COALESCE(SUM(stock * "prixUnitaire"), 0)::text AS valeur,
          COUNT(*)::text AS nb
        FROM "Produit"
      `,

      // 2. Créances packs = montantRestant des souscriptions ACTIF (à encaisser)
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT COALESCE(SUM("montantRestant"), 0)::text AS total, COUNT(*)::text AS cnt
        FROM "SouscriptionPack"
        WHERE statut = 'ACTIF'
      `,

      // 3. Versements collectés depuis le 1er janvier (CPC Produits)
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT COALESCE(SUM(montant), 0)::text AS total, COUNT(*)::text AS cnt
        FROM "VersementPack"
        WHERE "datePaiement" >= ${yearStart}
      `,

      // 4. Approvisionnements depuis le 1er janvier (CPC Charges)
      prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(m.quantite * p."prixUnitaire"), 0)::text AS total
        FROM "MouvementStock" m
        JOIN "Produit" p ON p.id = m."produitId"
        WHERE m.type = 'ENTREE' AND m."dateMouvement" >= ${yearStart}
      `,

      // 5. Stats souscriptions pour ratios
      prisma.$queryRaw<{
        total_montant: string;
        total_verse:   string;
        total_cnt:     string;
        complete_cnt:  string;
      }[]>`
        SELECT
          COALESCE(SUM("montantTotal"), 0)::text  AS total_montant,
          COALESCE(SUM("montantVerse"), 0)::text  AS total_verse,
          COUNT(*)::text                          AS total_cnt,
          COUNT(*) FILTER (WHERE statut = 'COMPLETE')::text AS complete_cnt
        FROM "SouscriptionPack"
      `,
    ]);

    // ── ACTIF ──────────────────────────────────────────────────────────────

    const actifStock       = Number(stockValeur[0]?.valeur ?? 0);
    const actifCreances    = Number(creancesPacks[0]?.total ?? 0);
    const actifCreancesCnt = Number(creancesPacks[0]?.cnt ?? 0);
    const totalActif       = actifStock + actifCreances;

    // ── PASSIF ─────────────────────────────────────────────────────────────
    // Engagements = montantRestant à encaisser (ce qui reste dû par les membres)

    const passifEngagements    = actifCreances;
    const passifEngagementsCnt = actifCreancesCnt;
    const capitauxPropres      = Math.max(0, totalActif - passifEngagements);
    const totalPassif          = passifEngagements + capitauxPropres;

    // ── CPC ────────────────────────────────────────────────────────────────

    const prodVersements = Number(produitsVersements[0]?.total ?? 0);
    const totalProduits  = prodVersements;
    const chAppro        = Number(chargesAppro[0]?.total ?? 0);
    const totalCharges   = chAppro;
    const resultatNet    = totalProduits - totalCharges;

    // ── RATIOS ─────────────────────────────────────────────────────────────

    const stats        = souscriptionsStats[0];
    const totalMontant = Number(stats?.total_montant ?? 0);
    const totalVerse   = Number(stats?.total_verse ?? 0);
    const totalCnt     = Number(stats?.total_cnt ?? 0);
    const completeCnt  = Number(stats?.complete_cnt ?? 0);

    const tauxRecouvrement = totalMontant > 0
      ? Math.round((totalVerse / totalMontant) * 100)
      : 0;

    const tauxCompletion = totalCnt > 0
      ? Math.round((completeCnt / totalCnt) * 100)
      : 0;

    const margeNette = totalProduits > 0
      ? Math.round((resultatNet / totalProduits) * 100)
      : 0;

    const ratioCharges = totalProduits > 0
      ? Math.round((totalCharges / totalProduits) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        annee: now.getFullYear(),
        bilan: {
          actif: {
            stock:         { valeur: actifStock, nombreProduits: Number(stockValeur[0]?.nb ?? 0) },
            creancesPacks: { valeur: actifCreances, count: actifCreancesCnt },
            total: totalActif,
          },
          passif: {
            engagementsPacks: { valeur: passifEngagements, count: passifEngagementsCnt },
            capitauxPropres,
            total: totalPassif,
          },
        },
        compteResultat: {
          produits: {
            versementsCollectes: prodVersements,
            total: totalProduits,
          },
          charges: {
            approvisionnements: chAppro,
            total: totalCharges,
          },
          resultatNet,
        },
        ratios: {
          tauxRecouvrement,
          tauxCompletion,
          margeNette,
          ratioCharges,
        },
      },
    });
  } catch (error) {
    console.error("COMPTABLE ETATS FINANCIERS ERROR:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
