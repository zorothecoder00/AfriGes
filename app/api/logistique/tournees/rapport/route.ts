import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionLivraison } from "@/lib/tourneeLivraison";

/**
 * GET /api/logistique/tournees/rapport — "Rapport de livraison" (CDC §5.7),
 * agrégation sur une période, pas de nouveau modèle (dérivé de TourneeArret).
 * Query : dateDebut?, dateFin?, livreurId?
 */
export async function GET(req: Request) {
  try {
    const session = await getSessionLivraison();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const dateDebut = searchParams.get("dateDebut");
    const dateFin = searchParams.get("dateFin");
    const livreurId = searchParams.get("livreurId");

    const tournees = await prisma.tourneeLivraison.findMany({
      where: {
        ...(livreurId && { livreurId: Number(livreurId) }),
        ...((dateDebut || dateFin) && {
          dateTournee: {
            ...(dateDebut && { gte: new Date(dateDebut) }),
            ...(dateFin && { lte: new Date(new Date(dateFin).setHours(23, 59, 59, 999)) }),
          },
        }),
      },
      select: {
        id: true, statut: true,
        livreur: { select: { id: true, nom: true, prenom: true } },
        arrets: { select: { statut: true } },
      },
    });

    let nbArrets = 0, nbEffectues = 0, nbNonEffectues = 0, nbIncidents = 0, nbPlanifies = 0;
    const parLivreurMap = new Map<number, { livreurId: number; nom: string; nbTournees: number; nbArrets: number; nbEffectues: number; nbNonEffectues: number; nbIncidents: number }>();

    for (const t of tournees) {
      if (!parLivreurMap.has(t.livreur.id)) {
        parLivreurMap.set(t.livreur.id, { livreurId: t.livreur.id, nom: `${t.livreur.prenom} ${t.livreur.nom}`, nbTournees: 0, nbArrets: 0, nbEffectues: 0, nbNonEffectues: 0, nbIncidents: 0 });
      }
      const l = parLivreurMap.get(t.livreur.id)!;
      l.nbTournees++;

      for (const a of t.arrets) {
        nbArrets++; l.nbArrets++;
        if (a.statut === "EFFECTUE") { nbEffectues++; l.nbEffectues++; }
        else if (a.statut === "NON_EFFECTUE") { nbNonEffectues++; l.nbNonEffectues++; }
        else if (a.statut === "INCIDENT") { nbIncidents++; l.nbIncidents++; }
        else nbPlanifies++;
      }
    }

    const nbConstates = nbEffectues + nbNonEffectues + nbIncidents;
    return NextResponse.json({
      global: {
        nbTournees: tournees.length,
        nbArrets, nbEffectues, nbNonEffectues, nbIncidents, nbPlanifies,
        tauxReussite: nbConstates > 0 ? Math.round((nbEffectues / nbConstates) * 100) : 0,
      },
      parLivreur: Array.from(parLivreurMap.values()).sort((a, b) => b.nbArrets - a.nbArrets),
    });
  } catch (error) {
    console.error("GET /logistique/tournees/rapport:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
