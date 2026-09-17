import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getComptableLectureSession } from "@/lib/authComptable";

/**
 * GET /api/comptable/factures-achat/fournisseurs-recherche?q=
 * Recherche fournisseur pour le formulaire de saisie de Facture fournisseur
 * (CDC digitalisation §5.3) — évite de dépendre de /api/logistique/fournisseurs
 * dont l'auth ne couvre pas le rôle Comptable.
 */
export async function GET(req: Request) {
  try {
    const session = await getComptableLectureSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (q.length < 2) return NextResponse.json({ data: [] });

    const where: Prisma.FournisseurWhereInput = {
      OR: [
        { nom: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
      ],
    };

    const fournisseurs = await prisma.fournisseur.findMany({
      where,
      select: { id: true, nom: true, code: true },
      take: 10,
    });
    return NextResponse.json({ data: fournisseurs });
  } catch (error) {
    console.error("GET /comptable/factures-achat/fournisseurs-recherche:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
