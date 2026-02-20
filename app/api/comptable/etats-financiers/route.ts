import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

/**
 * GET /api/comptable/etats-financiers
 *
 * Retourne :
 * - Bilan simplifié (Actif / Passif snapshot à aujourd'hui)
 * - Compte de résultat (Produits / Charges depuis le 1er janvier de l'année en cours)
 * - Ratios financiers
 */
export async function GET() {
  try {
    const session = await getComptableSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1); // 1er janvier

    // ── BILAN — ACTIF (snapshot) ───────────────────────────────────────────

    const [
      stockValeur,
      creancesCotisations,
      creditsAlimRestants,
      creditsFinanciersNonRembourses,
    ] = await Promise.all([

      // 1. Valeur du stock (actif immobilisé)
      prisma.$queryRaw<{ valeur: string; nb: string }[]>`
        SELECT
          COALESCE(SUM(stock * "prixUnitaire"), 0)::text AS valeur,
          COUNT(*)::text AS nb
        FROM "Produit"
      `,

      // 2. Créances sur cotisations EN_ATTENTE (argent à recevoir)
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT COALESCE(SUM(montant), 0)::text AS total, COUNT(*)::text AS cnt
        FROM "Cotisation"
        WHERE statut = 'EN_ATTENTE'
      `,

      // 3. Solde crédits alimentaires actifs restants (à consommer par les membres)
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT COALESCE(SUM("montantRestant"), 0)::text AS total, COUNT(*)::text AS cnt
        FROM "CreditAlimentaire"
        WHERE statut = 'ACTIF'
      `,

      // 4. Crédits financiers accordés non encore remboursés
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT COALESCE(SUM("montantRestant"), 0)::text AS total, COUNT(*)::text AS cnt
        FROM "Credit"
        WHERE statut IN ('APPROUVE', 'REMBOURSE_PARTIEL')
      `,
    ]);

    // ── BILAN — PASSIF (snapshot) ──────────────────────────────────────────

    const [
      engagementsTontines,
      plafondCreditsAlimAlloues,
      cotisationsPayeesTotal,
    ] = await Promise.all([

      // 1. Pots tontines EN_COURS à verser (engagements)
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT COALESCE(SUM("montantPot"), 0)::text AS total, COUNT(*)::text AS cnt
        FROM "TontineCycle"
        WHERE statut = 'EN_COURS'
      `,

      // 2. Plafond total crédits alimentaires alloués (engagement consommable)
      prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(plafond), 0)::text AS total
        FROM "CreditAlimentaire"
        WHERE statut IN ('ACTIF', 'EPUISE')
      `,

      // 3. Total cotisations collectées (fonds propres de référence)
      prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(montant), 0)::text AS total
        FROM "Cotisation"
        WHERE statut = 'PAYEE'
      `,
    ]);

    // ── COMPTE DE RÉSULTAT — PRODUITS (année en cours) ────────────────────

    const [
      produitsVentes,
      produitsCotisations,
      produitsContribs,
      produitsRemb,
    ] = await Promise.all([

      prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(quantite * "prixUnitaire"), 0)::text AS total
        FROM "VenteCreditAlimentaire"
        WHERE "createdAt" >= ${yearStart}
      `,

      prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(montant), 0)::text AS total
        FROM "Cotisation"
        WHERE statut = 'PAYEE' AND "datePaiement" >= ${yearStart}
      `,

      prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(montant), 0)::text AS total
        FROM "TontineContribution"
        WHERE statut = 'PAYEE' AND "datePaiement" >= ${yearStart}
      `,

      prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(montant), 0)::text AS total
        FROM "CreditTransaction"
        WHERE type = 'REMBOURSEMENT' AND "createdAt" >= ${yearStart}
      `,
    ]);

    // ── COMPTE DE RÉSULTAT — CHARGES (année en cours) ─────────────────────

    const [chargesAppro, chargesCredits, chargesPots] = await Promise.all([

      prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(m.quantite * p."prixUnitaire"), 0)::text AS total
        FROM "MouvementStock" m
        JOIN "Produit" p ON p.id = m."produitId"
        WHERE m.type = 'ENTREE' AND m."dateMouvement" >= ${yearStart}
      `,

      prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(montant), 0)::text AS total
        FROM "CreditTransaction"
        WHERE type = 'DECAISSEMENT' AND "createdAt" >= ${yearStart}
      `,

      prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM("montantPot"), 0)::text AS total
        FROM "TontineCycle"
        WHERE statut = 'COMPLETE' AND "dateCloture" >= ${yearStart}
      `,
    ]);

    // ── Calculs ────────────────────────────────────────────────────────────

    // ACTIF
    const actifStock              = Number(stockValeur[0].valeur);
    const actifCreancesCotisations = Number(creancesCotisations[0].total);
    const actifCreditsAlim        = Number(creditsAlimRestants[0].total);
    const actifCreditsFinanciers  = Number(creditsFinanciersNonRembourses[0].total);
    const totalActif = actifStock + actifCreancesCotisations + actifCreditsAlim + actifCreditsFinanciers;

    // PASSIF
    const passifEngagementsTontines = Number(engagementsTontines[0].total);
    const passifCreditsAlimAlloues  = Number(plafondCreditsAlimAlloues[0].total);
    const totalPassifEngagements    = passifEngagementsTontines + passifCreditsAlimAlloues;
    const capitauxPropres           = totalActif - totalPassifEngagements;
    const totalPassif               = totalPassifEngagements + Math.max(0, capitauxPropres);

    // CPC — PRODUITS
    const prodVentes      = Number(produitsVentes[0].total);
    const prodCotisations = Number(produitsCotisations[0].total);
    const prodContribs    = Number(produitsContribs[0].total);
    const prodRemb        = Number(produitsRemb[0].total);
    const totalProduits   = prodVentes + prodCotisations + prodContribs + prodRemb;

    // CPC — CHARGES
    const chAppro   = Number(chargesAppro[0].total);
    const chCredits = Number(chargesCredits[0].total);
    const chPots    = Number(chargesPots[0].total);
    const totalCharges = chAppro + chCredits + chPots;

    const resultatNet = totalProduits - totalCharges;

    // RATIOS
    const tauxRecouvrement = (Number(cotisationsPayeesTotal[0].total) + actifCreancesCotisations) > 0
      ? Math.round((Number(cotisationsPayeesTotal[0].total) / (Number(cotisationsPayeesTotal[0].total) + actifCreancesCotisations)) * 100)
      : 0;

    const tauxUtilisationCreditsAlim = passifCreditsAlimAlloues > 0
      ? Math.round(((passifCreditsAlimAlloues - actifCreditsAlim) / passifCreditsAlimAlloues) * 100)
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
            stock:                { valeur: actifStock,              nombreProduits: Number(stockValeur[0].nb) },
            creancesCotisations:  { valeur: actifCreancesCotisations, count: Number(creancesCotisations[0].cnt) },
            creditsAlimentaires:  { valeur: actifCreditsAlim,         count: Number(creditsAlimRestants[0].cnt) },
            creditsFinanciers:    { valeur: actifCreditsFinanciers,    count: Number(creditsFinanciersNonRembourses[0].cnt) },
            total: totalActif,
          },
          passif: {
            engagementsTontines: { valeur: passifEngagementsTontines, count: Number(engagementsTontines[0].cnt) },
            creditsAlimAlloues:  { valeur: passifCreditsAlimAlloues },
            capitauxPropres:     Math.max(0, capitauxPropres),
            total: totalPassif,
          },
        },
        compteResultat: {
          produits: {
            ventes:                  prodVentes,
            cotisationsCollectees:   prodCotisations,
            contributionsTontines:   prodContribs,
            remboursementsCredits:   prodRemb,
            total: totalProduits,
          },
          charges: {
            approvisionnements: chAppro,
            creditsDecaisses:   chCredits,
            potsTontinesVerses: chPots,
            total: totalCharges,
          },
          resultatNet,
        },
        ratios: {
          tauxRecouvrement,
          tauxUtilisationCreditsAlim,
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
