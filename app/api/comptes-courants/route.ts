import { NextResponse } from "next/server";
import { Prisma, StatutCompteCourant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import {
  chargerParametrageCC, genererNumeroCompte, calculerCleRib, formatRibComplet,
} from "@/lib/compteCourant";

/**
 * /api/comptes-courants
 * GET  — liste paginée + recherche (CDC §12) — capacité READ
 * POST — ouverture d'un compte pour un client existant — capacité CREATE
 */

const clientSelect = {
  id: true, nom: true, prenom: true, telephone: true, codeClient: true,
  quartier: true, ville: true, commune: true, photoUrl: true, etat: true,
  agentTerrain: { select: { id: true, nom: true, prenom: true } },
  pointDeVente: { select: { id: true, nom: true, code: true } },
} satisfies Prisma.ClientSelect;

export async function GET(req: Request) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, Number(searchParams.get("page") || 1));
  const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
  const skip   = (page - 1) * limit;
  const search = (searchParams.get("search") || "").trim();
  const statut = searchParams.get("statut") as StatutCompteCourant | null;

  const insensitive = { mode: "insensitive" as const };
  const where: Prisma.CompteCourantWhereInput = {
    ...(statut && { statut }),
    ...(search && {
      OR: [
        { numeroCompte: { contains: search } },
        { ribComplet:   { contains: search, ...insensitive } },
        { client: { nom:        { contains: search, ...insensitive } } },
        { client: { prenom:     { contains: search, ...insensitive } } },
        { client: { telephone:  { contains: search } } },
        { client: { codeClient: { contains: search, ...insensitive } } },
        { client: { quartier:   { contains: search, ...insensitive } } },
        { client: { ville:      { contains: search, ...insensitive } } },
        { client: { commune:    { contains: search, ...insensitive } } },
        { client: { agentTerrain: { OR: [
          { nom:    { contains: search, ...insensitive } },
          { prenom: { contains: search, ...insensitive } },
        ] } } },
      ],
    }),
  };

  const [comptes, total] = await Promise.all([
    prisma.compteCourant.findMany({
      where, skip, take: limit, orderBy: { createdAt: "desc" },
      select: {
        id: true, numeroCompte: true, ribComplet: true, statut: true,
        solde: true, totalDepose: true, totalRetire: true, totalUtilise: true,
        nbMouvements: true, dateOuverture: true, derniereOperationAt: true,
        client: { select: clientSelect },
        agentCreateur: { select: { id: true, nom: true, prenom: true } },
      },
    }),
    prisma.compteCourant.count({ where }),
  ]);

  return NextResponse.json({ data: comptes, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
}

export async function POST(req: Request) {
  const session = await getCompteCourantSession("CREATE");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const clientId = Number(body?.clientId);
  if (!clientId) return NextResponse.json({ error: "Client requis" }, { status: 400 });

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  const deja = await prisma.compteCourant.findUnique({ where: { clientId }, select: { id: true } });
  if (deja) return NextResponse.json({ error: "Ce client possède déjà un compte courant" }, { status: 409 });

  const param = await chargerParametrageCC();

  // Génération du numéro (12 chiffres) avec retry en cas de collision concurrente.
  for (let attempt = 0; attempt < 6; attempt++) {
    const count        = await prisma.compteCourant.count();
    const numeroCompte = genererNumeroCompte(count + 1 + attempt);
    const cleRib       = calculerCleRib(numeroCompte);
    const ribComplet   = formatRibComplet(param.codeAgence, param.codeGuichet, numeroCompte, cleRib);

    try {
      const compte = await prisma.compteCourant.create({
        data: {
          numeroCompte, cleRib, ribComplet,
          codeAgence: param.codeAgence, codeGuichet: param.codeGuichet,
          clientId,
          agentCreateurId: Number(session.user.id),
        },
        select: {
          id: true, numeroCompte: true, ribComplet: true, cleRib: true,
          codeAgence: true, codeGuichet: true, statut: true, solde: true,
          dateOuverture: true,
          client: { select: clientSelect },
          agentCreateur: { select: { id: true, nom: true, prenom: true } },
        },
      });

      await prisma.auditLog.create({
        data: { userId: Number(session.user.id), action: "CREATION_COMPTE_COURANT", entite: "CompteCourant", entiteId: compte.id },
      });

      return NextResponse.json({ data: compte }, { status: 201 });
    } catch (e) {
      // Collision sur le numéro → on retente avec le compteur réévalué
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = (e.meta?.target as string[] | string | undefined);
        const onClient = Array.isArray(target) ? target.includes("clientId") : String(target).includes("clientId");
        if (onClient) return NextResponse.json({ error: "Ce client possède déjà un compte courant" }, { status: 409 });
        continue; // collision numeroCompte → retry
      }
      console.error("POST /api/comptes-courants", e);
      return NextResponse.json({ error: "Erreur lors de l'ouverture du compte" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Impossible de générer un numéro unique, réessayez" }, { status: 500 });
}
