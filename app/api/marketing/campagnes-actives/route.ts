import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/marketing/campagnes-actives
 * Liste légère (id/code/nom) des campagnes marketing au statut ACTIVE —
 * utilisée pour le sélecteur "Campagne (optionnelle)" sur les écrans de
 * saisie de vente/crédit/souscription, tous rôles confondus (Caissier, RPV,
 * Agent terrain, RVC, Admin). Contrairement à /api/admin/marketing/*, pas de
 * garde marketing:LECTURE — n'importe quel utilisateur authentifié peut lire
 * cette liste de noms de campagnes, donnée non sensible nécessaire à
 * l'attribution manuelle d'une vente (CDC §85).
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const campagnes = await prisma.campagne.findMany({
    where: { statut: "ACTIVE" },
    select: { id: true, code: true, nom: true },
    orderBy: { nom: "asc" },
  });

  return NextResponse.json({ data: campagnes });
}
