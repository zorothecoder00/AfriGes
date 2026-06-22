import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

/**
 * GET /api/admin/ria/clients-eligibles
 * Clients identifiés par le RVC (statut VALIDE) — seuls ceux-ci sont affectables
 * à un investisseur RIA. ?search=
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const search = (req.nextUrl.searchParams.get("search") || "").trim();
    const pdvId  = req.nextUrl.searchParams.get("pdvId");

    const clients = await prisma.client.findMany({
      where: {
        etat: "ACTIF",
        eligibiliteRIA: { is: { statut: "VALIDE" } },
        ...(pdvId && { pointDeVenteId: parseInt(pdvId) }),
        ...(search && {
          OR: [
            { nom:        { contains: search, mode: "insensitive" } },
            { prenom:     { contains: search, mode: "insensitive" } },
            { telephone:  { contains: search, mode: "insensitive" } },
            { codeClient: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { nom: "asc" },
      take: 200,
      select: {
        id: true, codeClient: true, nom: true, prenom: true, telephone: true,
        activite: true, ville: true, niveauRisque: true, scoreSolvabilite: true,
        pointDeVente: { select: { nom: true } },
        eligibiliteRIA: {
          select: { montantDemande: true, classeRisque: true, scoreEligibilite: true, dateDecision: true },
        },
      },
    });

    return NextResponse.json({ data: clients });
  } catch (error) {
    console.error("GET /api/admin/ria/clients-eligibles", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
