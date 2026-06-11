import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const portefeuilleId = searchParams.get("portefeuilleId");
    const mois           = searchParams.get("mois");
    const annee          = searchParams.get("annee");
    const statut         = searchParams.get("statut");
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
    const skip  = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (portefeuilleId) where.portefeuilleId = parseInt(portefeuilleId);
    if (mois)           where.mois           = parseInt(mois);
    if (annee)          where.annee          = parseInt(annee);
    if (statut)         where.statut         = statut;

    const [distributions, total] = await Promise.all([
      prisma.distributionBenefice.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ annee: "desc" }, { mois: "desc" }],
        include: {
          portefeuille: {
            include: {
              profilRIA: {
                include: {
                  gestionnaire: { include: { member: { select: { id: true, nom: true, prenom: true } } } },
                },
              },
            },
          },
        },
      }),
      prisma.distributionBenefice.count({ where }),
    ]);

    return NextResponse.json({
      data: distributions,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/distributions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { portefeuilleId, mois, annee } = await req.json();

    if (!portefeuilleId || !mois || !annee) {
      return NextResponse.json({ error: "portefeuilleId, mois et annee sont obligatoires" }, { status: 400 });
    }

    // Vérifier doublon
    const existing = await prisma.distributionBenefice.findUnique({
      where: { portefeuilleId_mois_annee: { portefeuilleId: parseInt(portefeuilleId), mois: parseInt(mois), annee: parseInt(annee) } },
    });
    if (existing) {
      return NextResponse.json({ error: "Une distribution existe déjà pour ce portefeuille et cette période" }, { status: 409 });
    }

    const pf = await prisma.portefeuilleRIA.findUnique({ where: { id: parseInt(portefeuilleId) } });
    if (!pf) return NextResponse.json({ error: "Portefeuille introuvable" }, { status: 404 });

    const config = await prisma.configBeneficeRIA.findFirst({ where: { actif: true }, orderBy: { createdAt: "desc" } });
    const tGenere     = config ? Number(config.tauxGenere)       / 100 : 0.10;
    const tDistribue  = config ? Number(config.tauxDistribue)    / 100 : 0.04;
    const tReinvesti  = config ? Number(config.tauxReinvesti)    / 100 : 0.04;
    const tFondSec    = config ? Number(config.tauxFondSecurite) / 100 : 0.02;

    const capitalBase         = Number(pf.capitalEngage);
    const montantGenere       = Math.round(capitalBase * tGenere       * 100) / 100;
    const montantDistribue    = Math.round(capitalBase * tDistribue    * 100) / 100;
    const montantReinvesti    = Math.round(capitalBase * tReinvesti    * 100) / 100;
    const montantFondSecurite = Math.round(capitalBase * tFondSec      * 100) / 100;

    const distribution = await prisma.distributionBenefice.create({
      data: {
        portefeuilleId:     parseInt(portefeuilleId),
        mois:               parseInt(mois),
        annee:              parseInt(annee),
        capitalBase,
        tauxGenere:         tGenere,
        tauxDistribue:      tDistribue,
        tauxReinvesti:      tReinvesti,
        tauxFondSecurite:   tFondSec,
        montantGenere,
        montantDistribue,
        montantReinvesti,
        montantFondSecurite,
      },
    });

    return NextResponse.json({ data: distribution }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/ria/distributions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
