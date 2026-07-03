import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ reference: string }> };

const num = (v: unknown) => Number(v ?? 0);

/**
 * GET /api/public/suivi/[reference] — PUBLIC (aucune authentification)
 * Ouvert au scan du QR du bordereau. Renvoie l'évolution des remboursements
 * d'un crédit identifié par sa référence. Données volontairement minimales
 * (pas de garant, pas de coordonnées, pas d'autres crédits).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { reference } = await params;
    if (!reference) return NextResponse.json({ message: "Référence manquante" }, { status: 400 });

    const credit = await prisma.creditClient.findUnique({
      where:  { reference },
      select: {
        reference: true, statut: true, createdAt: true, dateDebut: true, dateEcheanceFin: true,
        montantTotal: true, montantRembourse: true, soldeRestant: true,
        dureeJours: true, montantJournalier: true, tauxPenalite: true, delaiGraceJours: true,
        client: {
          select: {
            codeClient: true, nom: true, prenom: true, sexe: true,
            agentTerrain: { select: { nom: true, prenom: true } },
            pointDeVente: { select: { nom: true } },
          },
        },
        echeances: {
          orderBy: { numeroEcheance: "asc" },
          select: { numeroEcheance: true, dateEcheance: true, montantDu: true, montantPaye: true, statut: true },
        },
      },
    });

    if (!credit) return NextResponse.json({ message: "Crédit introuvable" }, { status: 404 });

    return NextResponse.json({
      data: {
        reference:         credit.reference,
        statut:            credit.statut,
        createdAt:         credit.createdAt,
        dateDebut:         credit.dateDebut,
        dateEcheanceFin:   credit.dateEcheanceFin,
        montantTotal:      num(credit.montantTotal),
        montantRembourse:  num(credit.montantRembourse),
        soldeRestant:      num(credit.soldeRestant),
        dureeJours:        credit.dureeJours,
        montantJournalier: num(credit.montantJournalier),
        tauxPenalite:      num(credit.tauxPenalite),
        delaiGraceJours:   credit.delaiGraceJours,
        client: {
          codeClient:   credit.client.codeClient,
          nom:          credit.client.nom,
          prenom:       credit.client.prenom,
          sexe:         credit.client.sexe,
          agent:        credit.client.agentTerrain ? `${credit.client.agentTerrain.prenom} ${credit.client.agentTerrain.nom}` : null,
          pointDeVente: credit.client.pointDeVente?.nom ?? null,
        },
        echeances: credit.echeances.map((e) => ({
          numeroEcheance: e.numeroEcheance,
          dateEcheance:   e.dateEcheance,
          montantDu:      num(e.montantDu),
          montantPaye:    num(e.montantPaye),
          statut:         e.statut,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/public/suivi/[reference]", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
