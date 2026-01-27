import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getAuthSession();
  // ✅ Vérification session + rôle
  if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);     
  const search = searchParams.get("q") || "";  
  const skip = parseInt(searchParams.get("skip") || "0");
  const take = parseInt(searchParams.get("take") || "20");


  try {
    const produits = await prisma.produit.findMany({
    where: { nom: { contains: search, mode: "insensitive" } },
    skip,
    take,
    orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: produits });
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la récupération" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }


  const body = await req.json();
  const { nom, description, prixUnitaire, stock, alerteStock } = body;


  // Validation simple
  if (!nom || prixUnitaire == null || stock == null || alerteStock == null) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }


  try {
    const produit = await prisma.produit.create({
    data: { nom, description, prixUnitaire, stock, alerteStock },
    });
    return NextResponse.json({ data: produit });
  } catch (error) {
  return NextResponse.json({ error: "Impossible de créer le produit" }, { status: 500 });
  }
}