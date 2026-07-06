import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { chargerCreditsAEncaisser } from "@/lib/remboursementCredit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/comptes-courants/[id]/credits-payables
 * Crédits ACTIF/EN_RETARD du client du compte, payables depuis le compte courant.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const compte = await prisma.compteCourant.findUnique({
    where: { id: Number(id) }, select: { clientId: true },
  });
  if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  const credits = await chargerCreditsAEncaisser({ clientId: compte.clientId });
  return NextResponse.json({ data: credits });
}
