import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET — Détail complet d'une souscription (versements, échéances, réceptions).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;

    const souscription = await prisma.souscriptionPack.findUnique({
      where: { id: parseInt(id) },
      include: {
        pack: true,
        user: { select: { id: true, nom: true, prenom: true, telephone: true } },
        client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        versements: { orderBy: { datePaiement: "desc" } },
        echeances: { orderBy: { numero: "asc" } },
        receptions: {
          include: {
            lignes: {
              include: { produit: { select: { nom: true, prixUnitaire: true } } },
            },
          },
        },
      },
    });

    if (!souscription) {
      return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    }

    return NextResponse.json(souscription);
  } catch (error) {
    console.error("GET /api/caissier/packs/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
