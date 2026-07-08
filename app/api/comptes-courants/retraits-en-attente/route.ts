import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";

/**
 * GET /api/comptes-courants/retraits-en-attente
 * File d'attente globale des retraits à valider, tous comptes confondus (CDC §9).
 * Capacité VALIDATE (Chef d'agence, Directeur/Responsable économique, Admin) :
 * évite au valideur d'ouvrir les comptes un par un.
 */
export async function GET() {
  const session = await getCompteCourantSession("VALIDATE");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const retraits = await prisma.mouvementCompteCourant.findMany({
    where: { nature: "RETRAIT", statut: "EN_ATTENTE" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, reference: true, montant: true, soldeAvant: true, soldeApres: true,
      modePaiement: true, observation: true, createdAt: true, agence: true,
      user: { select: { id: true, nom: true, prenom: true } },
      compte: {
        select: {
          id: true, numeroCompte: true, solde: true,
          client: { select: { nom: true, prenom: true, telephone: true, codeClient: true } },
        },
      },
    },
  });

  return NextResponse.json({ data: retraits });
}
