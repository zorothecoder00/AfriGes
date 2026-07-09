import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/catalogue/referentiels
 * Charge tous les référentiels de classification du catalogue (Catalogue §2, §3) :
 * familles (+ sous-familles), catégories (+ sous-catégories), marques, unités.
 * Réservé aux administrateurs.
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const [familles, categories, marques, unites] = await Promise.all([
    prisma.familleProduit.findMany({
      orderBy: { nom: "asc" },
      select: {
        id: true, nom: true, description: true, actif: true,
        sousFamilles: { orderBy: { nom: "asc" }, select: { id: true, nom: true, actif: true, _count: { select: { produits: true } } } },
        _count: { select: { produits: true } },
      },
    }),
    prisma.categorieProduit.findMany({
      orderBy: { nom: "asc" },
      select: {
        id: true, nom: true, description: true, actif: true,
        sousCategories: { orderBy: { nom: "asc" }, select: { id: true, nom: true, actif: true, _count: { select: { produits: true } } } },
        _count: { select: { produits: true } },
      },
    }),
    prisma.marqueProduit.findMany({
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, logoUrl: true, actif: true, _count: { select: { produits: true } } },
    }),
    prisma.uniteProduit.findMany({
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, symbole: true, actif: true, _count: { select: { produitsVente: true, produitsAchat: true } } },
    }),
  ]);

  return NextResponse.json({ data: { familles, categories, marques, unites } });
}
