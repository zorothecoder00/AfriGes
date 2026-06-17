import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";

type Ctx = { params: Promise<{ id: string }> };

async function estMembreOptimisation(userId: number) {
  const membre = await prisma.membreCommissionRIA.findFirst({
    where: { userId, typeCommission: "OPTIMISATION", actif: true },
  });
  return !!membre;
}

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    if (auth.commission !== null && !(await estMembreOptimisation(userId))) {
      return NextResponse.json({ error: "Réservé aux membres de la commission Optimisation" }, { status: 403 });
    }

    const { id } = await params;
    const analyseId = parseInt(id);

    const analyse = await prisma.analyseOptimisationRIA.findUnique({ where: { id: analyseId } });
    if (!analyse) return NextResponse.json({ error: "Analyse introuvable" }, { status: 404 });
    if (analyse.resolutionId) return NextResponse.json({ error: "Déjà transformée en suggestion" }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.resolutionCommRIA.count({ where: { typeCommission: "OPTIMISATION" } });
      const numero = `RES-OPT-${String(count + 1).padStart(3, "0")}`;

      const resolution = await tx.resolutionCommRIA.create({
        data: {
          typeCommission: "OPTIMISATION",
          numero,
          titre: analyse.analyse,
          description: [
            analyse.objectifCible ? `Objectif : ${analyse.objectifCible}` : null,
            analyse.recommandationDetail ?? null,
          ].filter(Boolean).join("\n") || null,
        },
      });

      const updated = await tx.analyseOptimisationRIA.update({
        where: { id: analyseId },
        data: { resolutionId: resolution.id, statut: "TRAITEE" },
        include: { resolution: { select: { id: true, numero: true, titre: true, statut: true } } },
      });

      return updated;
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
