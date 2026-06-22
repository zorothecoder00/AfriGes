import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { evaluerEligibiliteClientRIA } from "@/lib/riaEligibilite";

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
          niveauRisque: true, scoreSolvabilite: true, limiteCredit: true, soldeActuel: true,
          createdAt: true,
          pointDeVente: { select: { nom: true, code: true } },
          eligibiliteRIA: {
            include: { identifiePar: { select: { nom: true, prenom: true } } },
          },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return NextResponse.json({
      data: clients,
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
 * Évalue un client et enregistre la décision automatique (upsert).
 * Body: { clientId, montantDemande }
 */
export async function POST(req: Request) {
  try {
    const session = await getRVCSession();
    const r = await resoudrePdv(session);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

    const { clientId, montantDemande } = await req.json();
    if (!clientId) return NextResponse.json({ error: "clientId est obligatoire" }, { status: 400 });
    const montant = Math.max(0, Number(montantDemande) || 0);

    const client = await prisma.client.findUnique({
      where: { id: parseInt(clientId) },
      select: { id: true, pointDeVenteId: true },
    });
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    if (r.pdvId !== null && client.pointDeVenteId !== r.pdvId) {
      return NextResponse.json({ error: "Ce client n'appartient pas à votre point de vente" }, { status: 403 });
    }

    const eligibilite = await prisma.$transaction(async (tx) => {
      const res = await evaluerEligibiliteClientRIA(tx, client.id, montant);
      const data = {
        montantDemande:      montant,
        ancienneteJours:     res.criteres.ancienneteJours,
        nbAchats:            res.criteres.nbAchats,
        volumeAchats:        res.criteres.volumeAchats,
        scoreSolvabilite:    res.criteres.scoreSolvabilite,
        niveauRisque:        res.criteres.niveauRisque,
        rotationCommerciale: res.criteres.rotationCommerciale,
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
