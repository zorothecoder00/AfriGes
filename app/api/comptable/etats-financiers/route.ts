import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

/**
 * GET /api/comptable/etats-financiers?annee=2025
 *
 * Sources incluses :
 *   Produits (CPC) : VersementPack + OperationCaisse ENCAISSEMENT
 *   Charges  (CPC) : MouvementStock ENTREE + OperationCaisse DECAISSEMENT
 *   Bilan          : snapshot actuel (stock + souscriptions actives)
 */
export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const currentYear = new Date().getFullYear();
    const annee    = Math.min(currentYear, Math.max(2020, Number(searchParams.get("annee") ?? currentYear)));
    const yearStart = new Date(annee, 0, 1);
    const yearEnd   = new Date(annee, 11, 31, 23, 59, 59, 999);

    const [
      stockValeur,
      creancesPacks,
      produitsVersements,
      chargesAppro,
      opcEncTotal,
      opcDecTotal,
      opcDecParCat,
      souscriptionsStats,
    ] = await Promise.all([

      // 1. Valeur du stock (actif — snapshot actuel)
      prisma.$queryRaw<{ valeur: string; nb: string }[]>`
        SELECT COALESCE(SUM(stock * "prixUnitaire"), 0)::text AS valeur,
               COUNT(*)::text AS nb
        FROM "Produit"
      `,

      // 2. Créances packs = montantRestant souscriptions ACTIF (snapshot actuel)
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT COALESCE(SUM("montantRestant"), 0)::text AS total, COUNT(*)::text AS cnt
        FROM "SouscriptionPack"
        WHERE statut = 'ACTIF'
      `,

      // 3. Versements packs sur l'année (CPC Produits — packs)
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT COALESCE(SUM(montant), 0)::text AS total, COUNT(*)::text AS cnt
        FROM "VersementPack"
        WHERE "datePaiement" >= ${yearStart} AND "datePaiement" <= ${yearEnd}
      `,

      // 4. Approvisionnements sur l'année (CPC Charges — stock)
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT COALESCE(SUM(m.quantite * p."prixUnitaire"), 0)::text AS total,
               COUNT(*)::text AS cnt
        FROM "MouvementStock" m
        JOIN "Produit" p ON p.id = m."produitId"
        WHERE m.type = 'ENTREE' AND m."dateMouvement" >= ${yearStart} AND m."dateMouvement" <= ${yearEnd}
      `,

      // 5. OperationCaisse ENCAISSEMENT sur l'année (CPC Produits — caisse)
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT COALESCE(SUM(montant), 0)::text AS total, COUNT(*)::text AS cnt
        FROM "OperationCaisse"
        WHERE type = 'ENCAISSEMENT' AND "createdAt" >= ${yearStart} AND "createdAt" <= ${yearEnd}
      `,

      // 6. OperationCaisse DECAISSEMENT total sur l'année (CPC Charges — caisse)
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT COALESCE(SUM(montant), 0)::text AS total, COUNT(*)::text AS cnt
        FROM "OperationCaisse"
        WHERE type = 'DECAISSEMENT' AND "createdAt" >= ${yearStart} AND "createdAt" <= ${yearEnd}
      `,

      // 7. OperationCaisse DECAISSEMENT groupé par catégorie (pour le détail)
      prisma.$queryRaw<{ categorie: string | null; total: string }[]>`
        SELECT categorie, COALESCE(SUM(montant), 0)::text AS total
        FROM "OperationCaisse"
        WHERE type = 'DECAISSEMENT' AND "createdAt" >= ${yearStart} AND "createdAt" <= ${yearEnd}
        GROUP BY categorie
      `,

      // 8. Stats souscriptions pour ratios (snapshot actuel)
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

    // ── ACTIF ─────────────────────────────────────────────────────────────────

    const actifStock       = Number(stockValeur[0]?.valeur ?? 0);
    const actifCreances    = Number(creancesPacks[0]?.total ?? 0);
    const actifCreancesCnt = Number(creancesPacks[0]?.cnt ?? 0);
    const totalActif       = actifStock + actifCreances;

    // ── PASSIF ────────────────────────────────────────────────────────────────

    const passifEngagements    = actifCreances;
    const passifEngagementsCnt = actifCreancesCnt;
    const capitauxPropres      = Math.max(0, totalActif - passifEngagements);
    const totalPassif          = passifEngagements + capitauxPropres;

    // ── CPC PRODUITS ──────────────────────────────────────────────────────────

    const prodVersements       = Number(produitsVersements[0]?.total ?? 0);
    const prodEncaissements    = Number(opcEncTotal[0]?.total ?? 0);
    const totalProduits        = prodVersements + prodEncaissements;

    // ── CPC CHARGES ───────────────────────────────────────────────────────────

    const chAppro    = Number(chargesAppro[0]?.total ?? 0);
    const chCaisse   = Number(opcDecTotal[0]?.total ?? 0);
    const totalCharges = chAppro + chCaisse;

    // Détail charges caisse par catégorie
    const decMap = Object.fromEntries(
      opcDecParCat.map((r) => [r.categorie ?? "AUTRE", Number(r.total)])
    );

    const resultatNet = totalProduits - totalCharges;

    // ── RATIOS ────────────────────────────────────────────────────────────────

    const stats        = souscriptionsStats[0];
    const totalMontant = Number(stats?.total_montant ?? 0);
    const totalVerse   = Number(stats?.total_verse ?? 0);
    const totalCnt     = Number(stats?.total_cnt ?? 0);
    const completeCnt  = Number(stats?.complete_cnt ?? 0);

    const tauxRecouvrement = totalMontant > 0 ? Math.round((totalVerse / totalMontant) * 100) : 0;
    const tauxCompletion   = totalCnt > 0     ? Math.round((completeCnt / totalCnt) * 100) : 0;
    const margeNette       = totalProduits > 0 ? Math.round((resultatNet / totalProduits) * 100) : 0;
    const ratioCharges     = totalProduits > 0 ? Math.round((totalCharges / totalProduits) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        annee,
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
            encaissementsCaisse: prodEncaissements,
            total: totalProduits,
          },
          charges: {
            approvisionnements: chAppro,
            salaires:           decMap["SALAIRE"]     ?? 0,
            avances:            decMap["AVANCE"]      ?? 0,
            fournisseurs:       decMap["FOURNISSEUR"] ?? 0,
            autresCaisse:       decMap["AUTRE"]       ?? 0,
            totalCaisse:        chCaisse,
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
