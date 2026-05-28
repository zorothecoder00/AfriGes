import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/magasinier/anomalies/[id]
 * Seule action autorisée : re-soumettre une anomalie rejetée (EN_COURS → EN_ATTENTE).
 * Les transitions TRANSMISE et TRAITEE sont réservées au Resp. Appro et à l'Admin.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const anomalieId = Number(id);
    if (isNaN(anomalieId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { statut } = body;

    // Le magasinier ne peut que re-soumettre une anomalie rejetée
    if (statut !== "EN_ATTENTE") {
      return NextResponse.json(
        { error: "Action non autorisée. Seule la re-soumission (EN_ATTENTE) est permise depuis cette interface." },
        { status: 403 }
      );
    }

    const anomalie = await prisma.anomalieStock.findUnique({
      where: { id: anomalieId },
      select: { statut: true, signalePar: true },
    });
    if (!anomalie) return NextResponse.json({ error: "Anomalie introuvable" }, { status: 404 });

    // Vérifier que l'anomalie appartient bien à ce magasinier
    const userId = parseInt(session.user.id);
    if (anomalie.signalePar !== userId) {
      return NextResponse.json({ error: "Accès refusé — cette anomalie ne vous appartient pas" }, { status: 403 });
    }

    // Seule une anomalie EN_COURS (rejetée par Resp. Appro) peut être re-soumise
    if (anomalie.statut !== "EN_COURS") {
      return NextResponse.json(
        { error: `Impossible de re-soumettre : statut actuel "${anomalie.statut}" (attendu : EN_COURS)` },
        { status: 400 }
      );
    }

    const updated = await prisma.anomalieStock.update({
      where: { id: anomalieId },
      data: {
        statut:      "EN_ATTENTE",
        commentaire: null,
        traitePar:   null,
      },
      include: {
        produit:    { select: { id: true, nom: true } },
        magasinier: { select: { nom: true, prenom: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /magasinier/anomalies/[id]:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}
