import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { getFidelite } from "@/lib/fidelite";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/comptes-courants/[id]/fidelite — capacité READ
 * Résumé fidélité du titulaire du compte (points, niveau, avantages, progression)
 * + historique des dernières transactions de points (CDC §19.D).
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const compteId = Number((await params).id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId }, select: { clientId: true },
  });
  if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  const resume = await getFidelite(compte.clientId);

  const compteFidelite = await prisma.compteFidelite.findUnique({
    where: { clientId: compte.clientId }, select: { id: true },
  });
  const historique = compteFidelite
    ? await prisma.transactionFidelite.findMany({
        where: { compteFideliteId: compteFidelite.id },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true, type: true, points: true, motif: true, source: true, createdAt: true,
          creePar: { select: { nom: true, prenom: true } },
        },
      })
    : [];

  return NextResponse.json({ data: { ...resume, historique } });
}
