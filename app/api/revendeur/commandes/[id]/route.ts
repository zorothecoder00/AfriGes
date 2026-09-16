import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRevendeurSession } from "@/lib/authRevendeur";
import { INCLUDE } from "@/app/api/admin/revendeurs/[id]/commandes/route";

type Ctx = { params: Promise<{ id: string }> };

const DETAIL_INCLUDE = {
  ...INCLUDE,
  bonLivraison: { include: { lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true } } } }, livreur: { select: { nom: true, prenom: true } } } },
  facture: { include: { lignes: true } },
};

/** GET /api/revendeur/commandes/[id] — détail complet (impression BC revendeur). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRevendeurSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const { id } = await params;
    const commande = await prisma.commandeRevendeur.findUnique({ where: { id: Number(id) }, include: DETAIL_INCLUDE });
    if (!commande || commande.revendeurId !== userId) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    }
    return NextResponse.json({ data: commande });
  } catch (error) {
    console.error("GET /revendeur/commandes/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
