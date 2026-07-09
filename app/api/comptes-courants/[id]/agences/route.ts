import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/comptes-courants/[id]/agences — capacité READ
 * Répartition de l'activité du compte par agence d'exécution (CDC §19.F) :
 * le compte est utilisable dans toutes les agences ; on restitue, par agence,
 * le nombre d'opérations et les flux entrées / sorties.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const compteId = Number((await params).id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const mouvements = await prisma.mouvementCompteCourant.findMany({
    where: { compteId, statut: "VALIDE" },
    select: { agence: true, montant: true },
  });

  const parAgence = new Map<string, { agence: string; nbOperations: number; totalEntrees: number; totalSorties: number }>();
  for (const m of mouvements) {
    const cle = m.agence ?? "—";
    const e = parAgence.get(cle) ?? { agence: cle, nbOperations: 0, totalEntrees: 0, totalSorties: 0 };
    const montant = Number(m.montant);
    e.nbOperations += 1;
    if (montant >= 0) e.totalEntrees += montant;
    else e.totalSorties += -montant;
    parAgence.set(cle, e);
  }

  const data = [...parAgence.values()].sort((a, b) => b.nbOperations - a.nbOperations);
  return NextResponse.json({ data });
}
