import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getReclamationSession } from "@/lib/authReclamation";
import { resolvePdvIdsAutorises } from "@/lib/reclamationClient";

/**
 * GET /api/admin/reclamations/clients-recherche?q=
 * Recherche client (nom/téléphone) pour le formulaire de réclamation,
 * scopée aux PDV autorisés (RPV/Chef d'agence) — évite de dépendre d'un
 * endpoint client d'un autre namespace dont l'auth ne couvre pas les 3 rôles.
 */
export async function GET(req: Request) {
  try {
    const session = await getReclamationSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (q.length < 2) return NextResponse.json({ data: [] });

    const pdvIds = await resolvePdvIdsAutorises(session);
    const where: Prisma.ClientWhereInput = {
      OR: [
        { nom: { contains: q, mode: "insensitive" } },
        { prenom: { contains: q, mode: "insensitive" } },
        { telephone: { contains: q } },
        { codeClient: { contains: q, mode: "insensitive" } },
      ],
      ...(pdvIds !== null && { pointDeVenteId: { in: pdvIds } }),
    };

    const clients = await prisma.client.findMany({
      where,
      select: { id: true, nom: true, prenom: true, telephone: true, codeClient: true, pointDeVenteId: true },
      take: 10,
    });
    return NextResponse.json({ data: clients });
  } catch (error) {
    console.error("GET /admin/reclamations/clients-recherche:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
