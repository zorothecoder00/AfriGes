import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { evaluerEligibiliteClientRIA, calculerSolvabiliteEligibilite } from "@/lib/riaEligibilite";

// Crédits comptés (hors annulés/rejetés) et crédits « en cours » (encours non soldé).
const CREDIT_STATUTS_COMPTES  = ["EN_ATTENTE_VALIDATION", "VALIDE", "ACTIF", "EN_RETARD", "SOLDE"] as const;
const CREDIT_STATUTS_EN_COURS = ["EN_ATTENTE_VALIDATION", "VALIDE", "ACTIF", "EN_RETARD"] as const;

async function resoudrePdv(session: Awaited<ReturnType<typeof getRVCSession>>) {
  if (!session) return { error: "Accès refusé" as const, status: 403 };
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  if (isAdmin) return { pdvId: null as number | null };
  const aff = await prisma.gestionnaireAffectation.findFirst({
    where: { userId: parseInt(session.user.id), actif: true },
    select: { pointDeVenteId: true },
  });
  if (!aff) return { error: "Aucun point de vente associé" as const, status: 400 };
  return { pdvId: aff.pointDeVenteId };
}

/**
 * GET /api/rvc/ria/eligibilite
 * Liste les clients (du PDV du RVC) avec leur éligibilité RIA courante.
 * ?statut=EN_ATTENTE|ELIGIBLE|REFUSE|VALIDE|RETIRE  ?search= ?page= ?limit=
 */
export async function GET(req: Request) {
  try {
    const session = await getRVCSession();
    const r = await resoudrePdv(session);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const search = (searchParams.get("search") || "").trim();
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 30)));
    const skip   = (page - 1) * limit;

    const where: Prisma.ClientWhereInput = {
      etat: "ACTIF",
      ...(r.pdvId !== null && { pointDeVenteId: r.pdvId }),
      ...(statut && { eligibiliteRIA: { is: { statut: statut as never } } }),
    };
    if (search) {
      where.OR = [
        { nom:        { contains: search, mode: "insensitive" } },
        { prenom:     { contains: search, mode: "insensitive" } },
        { telephone:  { contains: search, mode: "insensitive" } },
        { codeClient: { contains: search, mode: "insensitive" } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where, skip, take: limit, orderBy: { createdAt: "desc" },
        select: {
          id: true, codeClient: true, nom: true, prenom: true, telephone: true,
          activite: true, ville: true, quartier: true,
          createdAt: true,
          pointDeVente: { select: { nom: true, code: true } },
          eligibiliteRIA: {
            include: { identifiePar: { select: { nom: true, prenom: true } } },
          },
          // Historique réel (l'écran est un filtre fondé sur ventes + crédits + packs).
          creditsClients: {
            where: { statut: { in: [...CREDIT_STATUTS_COMPTES] } },
            select: { statut: true, montantTotal: true, soldeRestant: true },
          },
          souscriptionsPacks: {
            where: { statut: { not: "ANNULE" } },
            select: { montantTotal: true, montantVerse: true },
          },
        },
      }),
      prisma.client.count({ where }),
    ]);

    // Ventes directes agrégées en une seule requête (volume non disponible via _count).
    const ids = clients.map((c) => c.id);
    const ventesParClient = ids.length
      ? await prisma.venteDirecte.groupBy({
          by: ["clientId"],
          where: { clientId: { in: ids }, statut: { notIn: ["ANNULEE", "BROUILLON"] } },
          _count: { _all: true },
          _sum: { montantTotal: true },
        })
      : [];
    const ventesMap = new Map(ventesParClient.map((v) => [v.clientId, v]));

    // Calcule par client les agrégats + la solvabilité/risque sur l'historique réel.
    const data = clients.map((c) => {
      const credits = c.creditsClients ?? [];
      const nbCredits        = credits.length;
      const nbCreditsSoldes  = credits.filter((x) => x.statut === "SOLDE").length;
      const nbCreditsRetard  = credits.filter((x) => x.statut === "EN_RETARD").length;
      const nbCreditsEnCours = credits.filter((x) => (CREDIT_STATUTS_EN_COURS as readonly string[]).includes(x.statut)).length;
      const volumeCredits    = credits.reduce((s, x) => s + Number(x.montantTotal ?? 0), 0);
      const encoursCredit    = credits
        .filter((x) => (CREDIT_STATUTS_EN_COURS as readonly string[]).includes(x.statut))
        .reduce((s, x) => s + Number(x.soldeRestant ?? 0), 0);

      const packs = c.souscriptionsPacks ?? [];
      const nbPacks           = packs.length;
      const volumePacks       = packs.reduce((s, x) => s + Number(x.montantTotal ?? 0), 0);
      const montantVersePacks = packs.reduce((s, x) => s + Number(x.montantVerse ?? 0), 0);

      const v = ventesMap.get(c.id);
      const nbVentes     = v?._count._all ?? 0;
      const volumeAchats = Number(v?._sum.montantTotal ?? 0);

      const solva = calculerSolvabiliteEligibilite({
        nbAchats: nbVentes, volumeAchats,
        nbCredits, nbCreditsSoldes, nbCreditsEnCours, nbCreditsRetard, volumeCredits,
        nbPacks, volumePacks, montantVersePacks,
      });

      const { creditsClients: _c, souscriptionsPacks: _p, ...rest } = c;
      void _c; void _p;
      return {
        ...rest,
        nbVentes, nbCredits, nbCreditsRetard, encoursCredit, nbPacks,
        // Solvabilité & risque recalculés sur l'historique commercial réel.
        solvabilite: solva.score,
        niveauRisque: solva.niveauRisque,
      };
    });

    return NextResponse.json({
      data,
      pdvId: r.pdvId,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/rvc/ria/eligibilite", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/rvc/ria/eligibilite
 * Évalue un client sur son historique (ventes, crédits, packs, retards, risque,
 * solvabilité) et enregistre la décision automatique (upsert).
 * Body: { clientId }
 */
export async function POST(req: Request) {
  try {
    const session = await getRVCSession();
    const r = await resoudrePdv(session);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

    const { clientId } = await req.json();
    if (!clientId) return NextResponse.json({ error: "clientId est obligatoire" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { id: parseInt(clientId) },
      select: { id: true, pointDeVenteId: true },
    });
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    if (r.pdvId !== null && client.pointDeVenteId !== r.pdvId) {
      return NextResponse.json({ error: "Ce client n'appartient pas à votre point de vente" }, { status: 403 });
    }

    const eligibilite = await prisma.$transaction(async (tx) => {
      const res = await evaluerEligibiliteClientRIA(tx, client.id);
      const data = {
        ancienneteJours:     res.criteres.ancienneteJours,
        nbAchats:            res.criteres.nbAchats,
        volumeAchats:        res.criteres.volumeAchats,
        scoreSolvabilite:    res.criteres.scoreSolvabilite,
        niveauRisque:        res.criteres.niveauRisque,
        rotationCommerciale: res.criteres.rotationCommerciale,
        nbCredits:           res.criteres.nbCredits,
        nbCreditsRetard:     res.criteres.nbCreditsRetard,
        volumeCredits:       res.criteres.volumeCredits,
        nbPacks:             res.criteres.nbPacks,
        scoreEligibilite:    res.scoreEligibilite,
        classeRisque:        res.classeRisque,
        statut:              res.statut,
        motifs:              res.motifs,
        decisionAuto:        true,
        identifieParId:      session ? parseInt(session.user.id) : null,
        dateDecision:        new Date(),
      };
      return tx.eligibiliteClientRIA.upsert({
        where:  { clientId: client.id },
        create: { clientId: client.id, ...data },
        update: data,
      });
    });

    return NextResponse.json({ data: eligibilite }, { status: 201 });
  } catch (error) {
    console.error("POST /api/rvc/ria/eligibilite", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
