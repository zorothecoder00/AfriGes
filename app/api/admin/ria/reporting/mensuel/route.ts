import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

/**
 * GET  /api/admin/ria/reporting/mensuel
 * POST /api/admin/ria/reporting/mensuel
 *
 * GET  — liste tous les RapportMensuelRIA (avec infos portefeuille)
 * POST — { portefeuilleId?, mois, annee } → génère un snapshot JSON
 *   Si portefeuilleId absent, génère pour tous les portefeuilles actifs.
 *   Idempotent : met à jour si le rapport existe déjà.
 */

// ── Snapshot JSON ─────────────────────────────────────────────────────────────

async function genererSnapshotPF(portefeuilleId: number, mois: number, annee: number) {
  const pf = await prisma.portefeuilleRIA.findUnique({
    where: { id: portefeuilleId },
    include: {
      profilRIA: { select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true, email: true } } } } } },
      financements: {
        where: { statut: { in: ["ACTIF", "EN_RETARD", "REMBOURSE"] } },
        include: { client: { select: { nom: true, prenom: true } } },
      },
      distributions: { where: { mois, annee } },
      mouvements: {
        where: {
          createdAt: {
            gte: new Date(annee, mois - 1, 1),
            lt:  new Date(annee, mois, 1),
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!pf) return null;

  const distribution = pf.distributions[0] ?? null;
  const mouvementsMois = pf.mouvements;

  const entrees  = mouvementsMois.filter((m) => m.sens === "CREDIT").reduce((s, m) => s + Number(m.montant), 0);
  const sorties  = mouvementsMois.filter((m) => m.sens === "DEBIT").reduce((s, m) => s + Number(m.montant), 0);

  return {
    portefeuille: {
      id:               pf.id,
      reference:        pf.reference,
      nom:              pf.nom,
      investisseur:     pf.profilRIA?.gestionnaire?.member ? `${pf.profilRIA.gestionnaire.member.prenom} ${pf.profilRIA.gestionnaire.member.nom}` : "—",
      email:            pf.profilRIA?.gestionnaire?.member?.email ?? null,
    },
    periode:      { mois, annee },
    capitaux: {
      capitalInvesti:    Number(pf.capitalInvesti),
      capitalDisponible: Number(pf.capitalDisponible),
      capitalEngage:     Number(pf.capitalEngage),
      capitalRecouvre:   Number(pf.capitalRecouvre),
      capitalBloque:     Number(pf.capitalBloque),
    },
    benefices: {
      generes:    Number(pf.beneficesGeneres),
      distribues: Number(pf.beneficesDistribues),
      reinvestis: Number(pf.beneficesReinvestis),
      fondSecurite: Number(pf.fondSecurite),
    },
    distribution: distribution
      ? {
          id:             distribution.id,
          capitalBase:    Number(distribution.capitalBase),
          montantGenere:  Number(distribution.montantGenere),
          montantDistribue: Number(distribution.montantDistribue),
          montantReinvesti: Number(distribution.montantReinvesti),
          montantSecurite:  Number(distribution.montantFondSecurite),
          statut:         distribution.statut,
          datePaiement:   distribution.datePaiement,
        }
      : null,
    financementsActifs: pf.financements.filter((f) => f.statut === "ACTIF").length,
    financementsEnRetard: pf.financements.filter((f) => f.statut === "EN_RETARD").length,
    financementsRembourses: pf.financements.filter((f) => f.statut === "REMBOURSE").length,
    mouvementsMois: {
      entrees,
      sorties,
      solde: entrees - sorties,
      count: mouvementsMois.length,
    },
    genereLe: new Date().toISOString(),
  };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const pfId  = searchParams.get("portefeuilleId") ? parseInt(searchParams.get("portefeuilleId")!) : undefined;
    const mois  = searchParams.get("mois")  ? parseInt(searchParams.get("mois")!)  : undefined;
    const annee = searchParams.get("annee") ? parseInt(searchParams.get("annee")!) : undefined;

    const rapports = await prisma.rapportMensuelRIA.findMany({
      where: {
        ...(pfId  ? { portefeuilleId: pfId } : {}),
        ...(mois  ? { mois }  : {}),
        ...(annee ? { annee } : {}),
      },
      include: {
        portefeuille: {
          select: {
            reference: true,
            nom: true,
            profilRIA: { select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } } },
          },
        },
      },
      orderBy: [{ annee: "desc" }, { mois: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ rapports, total: rapports.length });
  } catch (error) {
    console.error("GET /api/admin/ria/reporting/mensuel", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body  = await req.json();
    const { mois, annee, portefeuilleId } = body as { mois: number; annee: number; portefeuilleId?: number };

    if (!mois || !annee || mois < 1 || mois > 12) {
      return NextResponse.json({ error: "mois (1-12) et annee requis" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);

    const ids: number[] = portefeuilleId
      ? [portefeuilleId]
      : (await prisma.portefeuilleRIA.findMany({ where: { actif: true }, select: { id: true } })).map((p) => p.id);

    const resultats: { portefeuilleId: number; action: "CREE" | "MAJ" }[] = [];

    for (const pfId of ids) {
      const donnees = await genererSnapshotPF(pfId, mois, annee);
      if (!donnees) continue;

      const existing = await prisma.rapportMensuelRIA.findUnique({
        where: { portefeuilleId_mois_annee: { portefeuilleId: pfId, mois, annee } },
      });

      if (existing) {
        await prisma.rapportMensuelRIA.update({
          where: { id: existing.id },
          data: { donnees, genereParId: userId },
        });
        resultats.push({ portefeuilleId: pfId, action: "MAJ" });
      } else {
        await prisma.rapportMensuelRIA.create({
          data: { portefeuilleId: pfId, mois, annee, donnees, genereParId: userId },
        });
        resultats.push({ portefeuilleId: pfId, action: "CREE" });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${resultats.length} rapport(s) généré(s) pour ${mois}/${annee}.`,
      resultats,
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/ria/reporting/mensuel", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
