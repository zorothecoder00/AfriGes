import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/comptes-courants/[id]
 * Détail d'un compte courant (CDC §6 — Consultation) — capacité READ.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const compteId = Number(id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId },
    select: {
      id: true, numeroCompte: true, ribComplet: true, cleRib: true,
      codeAgence: true, codeGuichet: true, statut: true, motifBlocage: true,
      solde: true, totalDepose: true, totalRetire: true, totalUtilise: true,
      nbMouvements: true, dateOuverture: true, derniereOperationAt: true,
      createdAt: true,
      client: {
        select: {
          id: true, nom: true, prenom: true, telephone: true, telephoneSecondaire: true,
          codeClient: true, quartier: true, ville: true, commune: true, adresse: true,
          photoUrl: true, etat: true, segment: true,
          agentTerrain: { select: { id: true, nom: true, prenom: true } },
          pointDeVente: { select: { id: true, nom: true, code: true } },
        },
      },
      agentCreateur: { select: { id: true, nom: true, prenom: true } },
    },
  });

  if (!compte) return NextResponse.json({ error: "Compte courant introuvable" }, { status: 404 });

  return NextResponse.json({ data: compte });
}
