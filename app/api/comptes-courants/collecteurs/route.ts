import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";

/**
 * GET /api/comptes-courants/collecteurs
 * Liste légère des agents de terrain (collecteurs) pour le sélecteur
 * « agent apporteur » des dépôts de compte courant. Ouvert à tout profil
 * disposant de la lecture du module CC (admin, chef d'agence, caissier…).
 */
export async function GET() {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const agents = await prisma.gestionnaire.findMany({
    where: { role: "AGENT_TERRAIN", actif: true },
    select: { member: { select: { id: true, nom: true, prenom: true } } },
    orderBy: { member: { nom: "asc" } },
  });

  return NextResponse.json({ data: agents.map((a) => a.member) });
}
