import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET  /api/admin/rh/paie/config/grilles  — liste les grilles salariales
 * POST /api/admin/rh/paie/config/grilles  — crée ou met à jour une grille
 *   Body: { id?, categorie, niveau, salaireMin, salaireMax, description? }
 *         Si id fourni → update ; sinon → create.
 */

export async function GET(_req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const grilles = await prisma.grilleSalariale.findMany({
      orderBy: [{ categorie: "asc" }, { niveau: "asc" }],
    });
    return NextResponse.json({ data: grilles });
  } catch (error) {
    console.error("GET /api/admin/rh/paie/config/grilles", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, categorie, niveau, salaireMin, salaireMax, description, actif } = await req.json();

    if (!categorie?.trim() || !niveau?.trim() || salaireMin === undefined || salaireMax === undefined) {
      return NextResponse.json({ error: "categorie, niveau, salaireMin et salaireMax sont obligatoires" }, { status: 400 });
    }

    if (id) {
      const updated = await prisma.grilleSalariale.update({
        where: { id: Number(id) },
        data: { categorie, niveau, salaireMin: Number(salaireMin), salaireMax: Number(salaireMax), description: description ?? null, actif: actif ?? undefined },
      });
      return NextResponse.json({ data: updated });
    }

    const grille = await prisma.grilleSalariale.create({
      data: { categorie, niveau, salaireMin: Number(salaireMin), salaireMax: Number(salaireMax), description: description ?? null },
    });
    return NextResponse.json({ data: grille }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/paie/config/grilles", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
