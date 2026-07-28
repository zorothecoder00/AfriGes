import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Historique des mouvements de stock d'un produit (50 derniers) — admin.
 * GET — journal entrée/sortie/ajustement, filtrable par point de vente.
 */
export async function GET(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const produitId = Number((await params).id);
  if (!produitId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const pointDeVenteId = searchParams.get("pointDeVenteId");

  const mouvements = await prisma.mouvementStock.findMany({
    where: {
      produitId,
      ...(pointDeVenteId ? { pointDeVenteId: Number(pointDeVenteId) } : {}),
    },
    orderBy: { dateMouvement: "desc" },
    take: 50,
    include: { pointDeVente: { select: { id: true, nom: true } } },
  });

  return NextResponse.json({ data: mouvements });
}
