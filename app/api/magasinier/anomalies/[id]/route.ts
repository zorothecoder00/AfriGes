import { NextResponse } from "next/server";
import { StatutAnomalie } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/magasinier/anomalies/[id]
 * Mettre à jour le statut d'une anomalie
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const { id } = await params;
    const anomalieId = Number(id);
    if (isNaN(anomalieId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { statut, commentaire } = body;

    const validStatuts: StatutAnomalie[] = ["EN_ATTENTE", "EN_COURS", "TRAITEE", "TRANSMISE"];
    if (!statut || !validStatuts.includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const anomalie = await prisma.anomalieStock.findUnique({ where: { id: anomalieId } });
    if (!anomalie) return NextResponse.json({ error: "Anomalie introuvable" }, { status: 404 });

    const updated = await prisma.anomalieStock.update({
      where: { id: anomalieId },
      data: {
        statut,
        commentaire: commentaire ?? anomalie.commentaire,
        traitePar:   parseInt(session.user.id),
      },
      include: {
        produit:    { select: { id: true, nom: true } },
        magasinier: { select: { nom: true, prenom: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /magasinier/anomalies/[id]:", error);
    return NextResponse.json({ error: "Erreur lors de la mise a jour" }, { status: 500 });
  }
}
