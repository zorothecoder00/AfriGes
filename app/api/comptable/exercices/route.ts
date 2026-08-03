import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { ouvrirExercice } from "@/lib/comptabilite/exercice";

/** GET /api/comptable/exercices — liste des exercices comptables (CDC §28-29). */
export async function GET() {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const exercices = await prisma.exerciceComptable.findMany({ orderBy: { annee: "desc" } });
    return NextResponse.json({ data: exercices });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** POST /api/comptable/exercices — Body: { annee } — ouvre l'exercice (idempotent). */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { annee } = body as { annee?: number };
    if (!annee) return NextResponse.json({ error: "annee requise" }, { status: 400 });

    const exercice = await prisma.$transaction((tx) => ouvrirExercice(tx, Number(annee)));
    return NextResponse.json({ data: exercice }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
