import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { requirePermission } from "@/lib/permissions";

/**
 * GET /api/comptable/produits?search=
 * Recherche légère de produits (id, nom) — CDC §24/§25 : imputation d'une
 * ligne budgétaire sur l'axe analytique Produit (réutilise le catalogue,
 * pas de modèle dédié).
 */
export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "comptabilite", "LECTURE");
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));

    const produits = await prisma.produit.findMany({
      where: search ? { nom: { contains: search, mode: "insensitive" } } : {},
      select: { id: true, nom: true },
      orderBy: { nom: "asc" },
      take: limit,
    });

    return NextResponse.json({ data: produits });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
