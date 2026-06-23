import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { clientDansPdv, clientAssigneAgent } from "@/lib/clientFiche";

/**
 * Gardes d'accès à la fiche client par rôle. Retournent `null` si l'accès est
 * autorisé, sinon une `Response` d'erreur prête à renvoyer.
 */

export async function gardeClientRVC(clientId: number): Promise<Response | null> {
  const session = await getRVCSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  if (isAdmin) return null;

  const aff = await prisma.gestionnaireAffectation.findFirst({
    where: { userId: parseInt(session.user.id), actif: true },
    select: { pointDeVenteId: true },
  });
  if (!aff) return NextResponse.json({ message: "Aucun point de vente associé" }, { status: 400 });

  const res = await clientDansPdv(clientId, aff.pointDeVenteId);
  if (res === "introuvable") return NextResponse.json({ message: "Client introuvable" }, { status: 404 });
  if (res === "hors-perimetre") return NextResponse.json({ message: "Ce client n'appartient pas à votre point de vente" }, { status: 403 });
  return null;
}

export async function gardeClientAgentTerrain(clientId: number): Promise<Response | null> {
  const session = await getAgentTerrainSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  if (isAdmin) return null;

  const res = await clientAssigneAgent(clientId, parseInt(session.user.id));
  if (res === "introuvable") return NextResponse.json({ message: "Client introuvable" }, { status: 404 });
  if (res === "hors-perimetre") return NextResponse.json({ message: "Ce client ne vous est pas affecté" }, { status: 403 });
  return null;
}
