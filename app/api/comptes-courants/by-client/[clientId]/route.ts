import { NextResponse } from "next/server";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { getCompteCourantParClient } from "@/lib/compteCourant";

type Ctx = { params: Promise<{ clientId: string }> };

/**
 * GET /api/comptes-courants/by-client/[clientId]
 * Compte courant d'un client (résumé) pour le POS « Payer avec le compte courant »
 * (CDC §3) — capacité READ. Renvoie 404 si le client n'a pas de compte courant.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { clientId } = await params;
  const id = Number(clientId);
  if (!id) return NextResponse.json({ error: "Client invalide" }, { status: 400 });

  const cc = await getCompteCourantParClient(id);
  if (!cc) return NextResponse.json({ error: "Ce client n'a pas de compte courant" }, { status: 404 });

  return NextResponse.json({
    data: {
      id: cc.id, numeroCompte: cc.numeroCompte, ribComplet: cc.ribComplet,
      statut: cc.statut, solde: Number(cc.solde),
    },
  });
}
