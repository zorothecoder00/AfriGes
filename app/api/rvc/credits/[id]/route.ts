import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/rvc/credits/[id]
 * Détail d'un crédit (scoped au PDV du RVC)
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    let rvcPdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff) return NextResponse.json({ error: "Aucun PDV associé" }, { status: 400 });
      rvcPdvId = aff.pointDeVenteId;
    }

    const credit = await prisma.creditClient.findUnique({
      where: { id: creditId },
      include: {
        client:    { select: { id: true, nom: true, prenom: true, codeClient: true, telephone: true } },
        creePar:   { select: { id: true, nom: true, prenom: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
        lignes: {
          orderBy: { id: "asc" },
          include: {
            produit:          { select: { id: true, nom: true, reference: true } },
            produitSubstitut: { select: { id: true, nom: true } },
            traitePar:        { select: { id: true, nom: true, prenom: true } },
          },
        },
        echeances:      { orderBy: { numeroEcheance: "asc" } },
        remboursements: {
          orderBy: { dateRemboursement: "desc" },
          include: { enregistrePar: { select: { id: true, nom: true, prenom: true } } },
        },
      },
    });

    if (!credit) return NextResponse.json({ error: "Crédit introuvable" }, { status: 404 });
    if (rvcPdvId !== null && credit.pointDeVenteId !== rvcPdvId) {
      return NextResponse.json({ error: "Accès refusé — PDV non autorisé" }, { status: 403 });
    }

    return NextResponse.json({ data: credit });
  } catch (error) {
    console.error("GET /api/rvc/credits/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
