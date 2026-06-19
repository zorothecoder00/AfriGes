import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";

// Recherche de gestionnaires (lecture) pour les membres de commission — utilisée
// par le sélecteur « Responsable demandeur » d'une demande de financement.
// Renvoie { data: [{ id, role, member: { id, nom, prenom } }] }.
export async function GET(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const limit  = Math.min(parseInt(searchParams.get("limit") ?? "8"), 20);

    if (search.length < 2) return NextResponse.json({ data: [] });

    const data = await prisma.gestionnaire.findMany({
      where: {
        actif: true,
        member: {
          OR: [
            { nom:    { contains: search, mode: "insensitive" } },
            { prenom: { contains: search, mode: "insensitive" } },
          ],
        },
      },
      select: { id: true, role: true, member: { select: { id: true, nom: true, prenom: true } } },
      orderBy: { member: { nom: "asc" } },
      take: limit,
    });

    return NextResponse.json({ data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
