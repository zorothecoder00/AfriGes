import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET — Liste tous les packs (templates de configuration).
 * POST — Crée un nouveau pack.
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const packs = await prisma.pack.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { souscriptions: true } },
      },
    });

    return NextResponse.json(packs);
  } catch (error) {
    console.error("GET /api/admin/packs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await req.json();
    const {
      nom,
      type,
      description,
      dureeJours,
      frequenceVersement,
      montantVersement,
      formuleRevendeur,
      montantCredit,
      montantSeuil,
      bonusPourcentage,
      cyclesBonusTrigger,
      acomptePercent,
      pointsParTranche,
      montantTranche,
    } = body;

    if (!nom || !type) {
      return NextResponse.json({ error: "Champs obligatoires : nom, type" }, { status: 400 });
    }

    const pack = await prisma.pack.create({
      data: {
        nom,
        type,
        description,
        dureeJours: dureeJours ? parseInt(dureeJours) : null,
        frequenceVersement: frequenceVersement ?? "HEBDOMADAIRE",
        montantVersement: montantVersement ? parseFloat(montantVersement) : null,
        formuleRevendeur: formuleRevendeur ?? null,
        montantCredit: montantCredit ? parseFloat(montantCredit) : null,
        montantSeuil: montantSeuil ? parseFloat(montantSeuil) : null,
        bonusPourcentage: bonusPourcentage ? parseFloat(bonusPourcentage) : null,
        cyclesBonusTrigger: cyclesBonusTrigger ? parseInt(cyclesBonusTrigger) : null,
        acomptePercent: acomptePercent ? parseFloat(acomptePercent) : null,
        pointsParTranche: pointsParTranche ? parseInt(pointsParTranche) : null,
        montantTranche: montantTranche ? parseFloat(montantTranche) : null,
      },
    });

    return NextResponse.json(pack, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/packs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
