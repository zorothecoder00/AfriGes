import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { ClasseRisqueRIA } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const portefeuilleId = searchParams.get("portefeuilleId");
    const clientId       = searchParams.get("clientId");
    const actif          = searchParams.get("actif");
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const skip  = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (portefeuilleId) where.portefeuilleId = parseInt(portefeuilleId);
    if (clientId)       where.clientId       = parseInt(clientId);
    if (actif !== null) where.actif          = actif !== "false";

    const [affectations, total] = await Promise.all([
      prisma.affectationClientRIA.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
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
          client: { select: { id: true, nom: true, prenom: true, telephone: true, niveauRisque: true, scoreSolvabilite: true } },
          _count: { select: { financements: true } },
          // Financements actifs liés à cette affectation pour calculer l'encours
          financements: {
            where:  { statut: { in: ["ACTIF", "EN_RETARD"] } },
            select: { encours: true, dateFinancement: true },
          },
        },
      }),
      prisma.affectationClientRIA.count({ where }),
    ]);

    // Enrichir chaque affectation avec encoursActuel et disponible
    // IMPORTANT : seuls les financements créés APRÈS la date de début de l'affectation
    // sont pris en compte — les opérations antérieures ne concernent pas le RIA.
    const data = affectations.map((a) => {
      const dateDebut = new Date(a.dateDebut);
      const finsPostAffectation = a.financements.filter(
        (f) => new Date(f.dateFinancement) >= dateDebut
      );
      const encoursActuel = finsPostAffectation.reduce((sum, f) => sum + Number(f.encours), 0);
      const disponible    = Math.max(0, Number(a.montantAlloue) - encoursActuel);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { financements: _f, ...rest } = a;
      return { ...rest, encoursActuel, disponible };
    });

    return NextResponse.json({
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/affectations", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { portefeuilleId, clientId, pourcentage, montantAlloue, classeRisque, notes } = await req.json();

    if (!portefeuilleId || !clientId || pourcentage === undefined) {
      return NextResponse.json({ error: "portefeuilleId, clientId et pourcentage sont obligatoires" }, { status: 400 });
    }

    if (Number(pourcentage) < 0 || Number(pourcentage) > 200) {
      return NextResponse.json({ error: "Le pourcentage doit être compris entre 0 et 200" }, { status: 400 });
    }

    const [pf, client] = await Promise.all([
      prisma.portefeuilleRIA.findUnique({ where: { id: parseInt(portefeuilleId) } }),
      prisma.client.findUnique({ where: { id: parseInt(clientId) } }),
    ]);
    if (!pf)     return NextResponse.json({ error: "Portefeuille introuvable" }, { status: 404 });
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    // montantAlloue est toujours dérivé du pourcentage × capitalInvesti côté serveur
    // pour garantir la cohérence — la valeur envoyée par le client est ignorée
    const montantAlloueCalcule = Math.round(Number(pourcentage) / 100 * Number(pf.capitalInvesti));

    // Calcul somme % actifs du portefeuille (hors ce client s'il a déjà une affectation)
    const autresAffectations = await prisma.affectationClientRIA.aggregate({
      where: {
        portefeuilleId: parseInt(portefeuilleId),
        actif:          true,
        clientId:       { not: parseInt(clientId) },
      },
      _sum: { pourcentage: true },
    });
    const sommePourcentages = Number(autresAffectations._sum.pourcentage ?? 0) + Number(pourcentage);
    const warning = sommePourcentages > 100
      ? `La somme des pourcentages atteint ${sommePourcentages.toFixed(1)} % (> 100 %). Le capital restant sera maintenu comme capitalDisponible.`
      : null;

    // Désactiver l'ancienne affectation active de ce client pour ce portefeuille
    await prisma.affectationClientRIA.updateMany({
      where: { portefeuilleId: parseInt(portefeuilleId), clientId: parseInt(clientId), actif: true },
      data:  { actif: false, dateFin: new Date() },
    });

    const affectation = await prisma.affectationClientRIA.create({
      data: {
        portefeuilleId: parseInt(portefeuilleId),
        clientId:       parseInt(clientId),
        pourcentage:    Number(pourcentage),
        montantAlloue:  montantAlloueCalcule,
        classeRisque:   (classeRisque as ClasseRisqueRIA) ?? "A",
        notes:          notes ?? null,
      },
    });

    return NextResponse.json({ data: affectation, warning }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/ria/affectations", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
