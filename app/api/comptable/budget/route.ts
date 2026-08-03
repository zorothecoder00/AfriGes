import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

/**
 * GET /api/comptable/budget?annee=2026
 * Retourne le budget de l'année (ou la liste des budgets existants si annee omis).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const annee = req.nextUrl.searchParams.get("annee");
    if (annee) {
      const budget = await prisma.budget.findUnique({ where: { annee: Number(annee) } });
      return NextResponse.json({ data: budget });
    }

    const budgets = await prisma.budget.findMany({ orderBy: { annee: "desc" } });
    return NextResponse.json({ data: budgets });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/budget
 * Body: { annee, libelle? } — crée le budget annuel s'il n'existe pas déjà.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { annee, libelle } = body as { annee?: number; libelle?: string };
    if (!annee) return NextResponse.json({ error: "annee requise" }, { status: 400 });

    const existing = await prisma.budget.findUnique({ where: { annee: Number(annee) } });
    if (existing) return NextResponse.json({ data: existing });

    const budget = await prisma.budget.create({
      data: { annee: Number(annee), libelle: libelle || null, userId: Number(session.user.id) },
    });
    return NextResponse.json({ data: budget }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
