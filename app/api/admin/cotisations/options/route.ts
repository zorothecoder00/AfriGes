import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

/**
 * ======================
 * GET - Options cotisation
 * ======================
 */
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();

    // 🔐 Sécurité
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Accès refusé" },
        { status: 403 }
      );
    }

    const options = await prisma.parametre.findMany({
      where: { cle: { startsWith: "cotisation_" } },
      orderBy: { cle: "asc" }
    });

    return NextResponse.json({ data: options },{ status: 200 });

  } catch (error) {
    console.error("GET /admin/cotisations/options", error);

    return NextResponse.json({ error: "Erreur interne du serveur" },{ status: 500 });
  }
}

/**
 * ======================
 * POST - Création option cotisation
 * ======================
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();

    // 🔐 Sécurité
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" },{ status: 403 });
    }

    const body = await req.json();
    const { cle, valeur } = body ?? {};

    // ✅ Validation métier
    if (!cle || typeof cle !== "string" || !cle.startsWith("cotisation_")) {
      return NextResponse.json({ error: "La clé doit commencer par 'cotisation_'" },{ status: 400 });
    }

    if (!valeur || typeof valeur !== "string") {
      return NextResponse.json({ error: "La valeur est obligatoire" },{ status: 400 });
    }

    // 🔁 Unicité
    const exists = await prisma.parametre.findUnique({
      where: { cle }
    });

    if (exists) {
      return NextResponse.json({ error: "Cette clé existe déjà" },{ status: 409 });
    }

    const option = await prisma.parametre.create({
      data: { cle, valeur }
    });

    return NextResponse.json({ message: "Paramètre créé avec succès", data: option}, { status: 201 });

  } catch (error) {
    console.error("POST /admin/cotisations/options", error);

    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}