import { NextResponse } from "next/server";
import { StatutDemandePrix } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { peutValiderPrix } from "@/lib/authCatalogue";

/**
 * GET /api/admin/catalogue/demandes-prix?statut=EN_ATTENTE
 * File des demandes de changement de prix (Catalogue §15), pour les valideurs
 * (Admin / Chef d'agence / Responsable Marketing).
 */
export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ message: "Non authentifié" }, { status: 401 });
  if (!peutValiderPrix(session.user.role, session.user.gestionnaireRole)) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statut = (searchParams.get("statut") as StatutDemandePrix | null) ?? "EN_ATTENTE";

  const demandes = await prisma.demandeChangementPrix.findMany({
    where: { statut },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, champ: true, ancienPrix: true, nouveauPrix: true, motif: true, statut: true,
      agence: true, createdAt: true,
      produit: { select: { id: true, nom: true, codeProduit: true } },
      demandePar: { select: { nom: true, prenom: true } },
    },
  });

  return NextResponse.json({
    data: demandes.map((d) => ({ ...d, ancienPrix: d.ancienPrix != null ? Number(d.ancienPrix) : null, nouveauPrix: Number(d.nouveauPrix) })),
  });
}
