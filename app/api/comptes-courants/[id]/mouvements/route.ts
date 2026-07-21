import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/comptes-courants/[id]/mouvements
 * Historique des mouvements du compte (CDC §7), paginé.
 */
export async function GET(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const compteId = Number(id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 30)));
  const skip  = (page - 1) * limit;

  const where = { compteId };
  const [mouvements, total] = await Promise.all([
    prisma.mouvementCompteCourant.findMany({
      where, skip, take: limit, orderBy: { createdAt: "desc" },
      select: {
        id: true, reference: true, nature: true, montant: true,
        soldeAvant: true, soldeApres: true, modePaiement: true, observation: true,
        statut: true, agence: true, createdAt: true,
        numeroJour: true, dateOperation: true,
        user: { select: { id: true, nom: true, prenom: true } },
        agentApporteur: { select: { id: true, nom: true, prenom: true } },
      },
    }),
    prisma.mouvementCompteCourant.count({ where }),
  ]);

  return NextResponse.json({ data: mouvements, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
}
