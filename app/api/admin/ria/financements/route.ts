import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { ecritureFinancementRIA } from "@/lib/riaComptable";

function refFin(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `FIN-${d}-${rand}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const statut         = searchParams.get("statut");
    const portefeuilleId = searchParams.get("portefeuilleId");
    const clientId       = searchParams.get("clientId");
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const skip  = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut)         where.statut         = statut;
    if (portefeuilleId) where.portefeuilleId = parseInt(portefeuilleId);
    if (clientId)       where.clientId       = parseInt(clientId);

    const [financements, total] = await Promise.all([
      prisma.operationFinancementRIA.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateFinancement: "desc" },
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
          client:      { select: { id: true, nom: true, prenom: true, telephone: true } },
          creditClient: { select: { id: true, reference: true, statut: true } },
          affectation:  { select: { id: true, classeRisque: true, pourcentage: true } },
          _count:       { select: { remboursements: true } },
        },
      }),
      prisma.operationFinancementRIA.count({ where }),
    ]);

    return NextResponse.json({
      data: financements,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/financements", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { portefeuilleId, clientId, montantFinance, creditClientId, affectationId, dateEcheance, notes } = body;

    if (!portefeuilleId || !clientId || !montantFinance || Number(montantFinance) <= 0) {
      return NextResponse.json({ error: "portefeuilleId, clientId et montantFinance (> 0) sont obligatoires" }, { status: 400 });
    }

    const pf = await prisma.portefeuilleRIA.findUnique({ where: { id: parseInt(portefeuilleId) } });
    if (!pf) return NextResponse.json({ error: "Portefeuille introuvable" }, { status: 404 });
    if (Number(pf.capitalDisponible) < Number(montantFinance)) {
      return NextResponse.json({ error: "Capital disponible insuffisant pour ce financement" }, { status: 400 });
    }

    const montant = Number(montantFinance);

    // ── Ligne de crédit : chercher l'affectation active pour ce portefeuille + client ──
    const affectationActive = await prisma.affectationClientRIA.findFirst({
      where: {
        portefeuilleId: parseInt(portefeuilleId),
        clientId:       parseInt(clientId),
        actif:          true,
      },
      include: {
        financements: {
          where:  { statut: { in: ["ACTIF", "EN_RETARD"] } },
          select: { encours: true },
        },
      },
    });

    let resolvedAffectationId: number | null = affectationId ? parseInt(affectationId) : null;

    if (affectationActive) {
      // Utiliser cette affectation (priorité sur l'éventuel affectationId passé manuellement)
      resolvedAffectationId = affectationActive.id;

      // Vérifier le plafond de la ligne de crédit
      const encoursActuel = affectationActive.financements.reduce((sum, f) => sum + Number(f.encours), 0);
      const disponible    = Number(affectationActive.montantAlloue) - encoursActuel;

      if (Number(affectationActive.montantAlloue) > 0 && montant > disponible) {
        return NextResponse.json({
          error: `Dépassement de la ligne de crédit. Plafond : ${Number(affectationActive.montantAlloue).toLocaleString("fr-FR")} FCFA — Encours actuel : ${encoursActuel.toLocaleString("fr-FR")} FCFA — Disponible : ${Math.max(0, disponible).toLocaleString("fr-FR")} FCFA.`,
        }, { status: 400 });
      }
    }

    const financement = await prisma.$transaction(async (tx) => {
      const fin = await tx.operationFinancementRIA.create({
        data: {
          reference:      refFin(),
          portefeuilleId: parseInt(portefeuilleId),
          clientId:       parseInt(clientId),
          montantFinance: montant,
          encours:        montant,
          creditClientId: creditClientId ? parseInt(creditClientId) : null,
          affectationId:  resolvedAffectationId,
          dateEcheance:   dateEcheance   ? new Date(dateEcheance)   : null,
          notes:          notes ?? null,
        },
      });

      await tx.portefeuilleRIA.update({
        where: { id: parseInt(portefeuilleId) },
        data: {
          capitalDisponible: { decrement: montant },
          capitalEngage:     { increment: montant },
        },
      });

      await tx.mouvementFondsRIA.create({
        data: {
          type:          "FINANCEMENT_CLIENT",
          montant,
          sens:          "DEBIT",
          description:   `Financement client ${parseInt(clientId)} — réf. ${fin.reference}`,
          reference:     fin.reference,
          portefeuilleId: parseInt(portefeuilleId),
          financementId: fin.id,
        },
      });

      const clientInfo = await tx.client.findUnique({
        where: { id: parseInt(clientId) },
        select: { nom: true, prenom: true },
      });
      const pf2 = await tx.portefeuilleRIA.findUnique({ where: { id: parseInt(portefeuilleId) }, select: { reference: true } });
      await ecritureFinancementRIA(tx, {
        montant,
        reference:      fin.reference,
        clientNom:      clientInfo ? `${clientInfo.prenom} ${clientInfo.nom}` : `Client ${clientId}`,
        portefeuilleRef: pf2?.reference ?? `PF-${portefeuilleId}`,
        userId:         parseInt(session.user.id),
      });

      return fin;
    });

    return NextResponse.json({ data: financement }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/ria/financements", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
