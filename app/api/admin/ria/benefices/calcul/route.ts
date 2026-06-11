import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

/**
 * POST /api/admin/ria/benefices/calcul
 * Déclenche le calcul mensuel des bénéfices pour tous les portefeuilles actifs.
 * Body: { mois: number (1-12), annee: number }
 *
 * Idempotent : si une distribution existe déjà pour mois/annee/portefeuille, elle est ignorée.
 * Logique : base = capitalEngage
 *   genere    = base × tauxGenere/100
 *   distribue = base × tauxDistribue/100
 *   reinvesti = base × tauxReinvesti/100
 *   securite  = base × tauxFondSecurite/100
 */
export async function POST(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { mois, annee } = body as { mois: number; annee: number };

    if (!mois || !annee || mois < 1 || mois > 12 || annee < 2020) {
      return NextResponse.json({ error: "mois (1-12) et annee (≥ 2020) requis" }, { status: 400 });
    }

    const config = await prisma.configBeneficeRIA.findFirst({
      where: { actif: true },
      orderBy: { createdAt: "desc" },
    });

    if (!config) {
      return NextResponse.json({ error: "Aucune configuration de taux active — configurez les taux avant de calculer" }, { status: 400 });
    }

    const portefeuilles = await prisma.portefeuilleRIA.findMany({
      where: { actif: true },
    });

    const userId = parseInt(session.user.id);
    let nbCrees = 0;
    let nbIgnores = 0;
    const details: { portefeuilleId: number; reference: string; montantGenere: number; statut: "CREE" | "IGNORE" }[] = [];

    await prisma.$transaction(async (tx) => {
      for (const pf of portefeuilles) {
        // Idempotence : ne pas recalculer si déjà fait
        const existe = await tx.distributionBenefice.findUnique({
          where: { portefeuilleId_mois_annee: { portefeuilleId: pf.id, mois, annee } },
        });
        if (existe) {
          nbIgnores++;
          details.push({ portefeuilleId: pf.id, reference: pf.reference, montantGenere: Number(existe.montantGenere), statut: "IGNORE" });
          continue;
        }

        const base = Number(pf.capitalEngage);
        if (base <= 0) {
          nbIgnores++;
          continue;
        }

        const montantGenere    = Number((base * Number(config.tauxGenere)       / 100).toFixed(2));
        const montantDistribue = Number((base * Number(config.tauxDistribue)    / 100).toFixed(2));
        const montantReinvesti = Number((base * Number(config.tauxReinvesti)    / 100).toFixed(2));
        const montantSecurite  = Number((base * Number(config.tauxFondSecurite) / 100).toFixed(2));

        const distribution = await tx.distributionBenefice.create({
          data: {
            portefeuilleId:      pf.id,
            mois,
            annee,
            capitalBase:         base,
            tauxGenere:          Number(config.tauxGenere),
            tauxDistribue:       Number(config.tauxDistribue),
            tauxReinvesti:       Number(config.tauxReinvesti),
            tauxFondSecurite:    Number(config.tauxFondSecurite),
            montantGenere,
            montantDistribue,
            montantReinvesti,
            montantFondSecurite: montantSecurite,
            statut:              "PLANIFIE",
            traitePar:           userId,
          },
        });

        // Mise à jour compteurs portefeuille
        await tx.portefeuilleRIA.update({
          where: { id: pf.id },
          data:  { beneficesGeneres: { increment: montantGenere } },
        });

        // Mouvement BENEFICE_GENERE
        await tx.mouvementFondsRIA.create({
          data: {
            portefeuilleId: pf.id,
            type:           "BENEFICE_GENERE",
            sens:           "CREDIT",
            montant:        montantGenere,
            distributionId: distribution.id,
            description:    `Bénéfice généré ${mois}/${annee} — base ${base.toLocaleString("fr-FR")} FCFA`,
          },
        });

        nbCrees++;
        details.push({ portefeuilleId: pf.id, reference: pf.reference, montantGenere, statut: "CREE" });
      }
    });

    return NextResponse.json({
      success: true,
      mois,
      annee,
      nbCrees,
      nbIgnores,
      details,
      message: `${nbCrees} distribution(s) calculée(s), ${nbIgnores} ignorée(s) (déjà existantes ou capital nul).`,
    });
  } catch (error) {
    console.error("POST /api/admin/ria/benefices/calcul", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
