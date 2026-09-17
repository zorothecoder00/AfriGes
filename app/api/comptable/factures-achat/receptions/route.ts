import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableLectureSession } from "@/lib/authComptable";

/**
 * GET /api/comptable/factures-achat/receptions?fournisseurId=
 * Liste les réceptions fournisseur récentes, pour le rattachement optionnel
 * d'une Facture fournisseur (CDC digitalisation §5.3).
 */
export async function GET(req: Request) {
  try {
    const session = await getComptableLectureSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const fournisseurId = searchParams.get("fournisseurId");
    if (!fournisseurId) return NextResponse.json({ data: [] });

    const receptions = await prisma.receptionApprovisionnement.findMany({
      where: { fournisseurId: Number(fournisseurId) },
      select: { id: true, reference: true, statut: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ data: receptions });
  } catch (error) {
    console.error("GET /comptable/factures-achat/receptions:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
