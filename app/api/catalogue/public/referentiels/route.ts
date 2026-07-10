import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Référentiels publics pour filtrer la vitrine / borne (familles, catégories,
 * marques actives). Léger, sans données confidentielles, sans authentification.
 */
export async function GET() {
  try {
    const [familles, categories, marques] = await Promise.all([
      prisma.familleProduit.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
      prisma.categorieProduit.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
      prisma.marqueProduit.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    ]);
    return NextResponse.json({ familles, categories, marques });
  } catch (error) {
    console.error("GET /api/catalogue/public/referentiels", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
