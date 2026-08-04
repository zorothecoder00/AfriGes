import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { verifierPreCloture } from "@/lib/comptabilite/assistantCloture";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/comptable/exercices/[id]/pre-cloture
 * Assistant de clôture (CDC §30) : état des lieux complet AVANT de tenter la
 * clôture définitive — ne modifie rien (dry-run). Permet au comptable de voir
 * à l'avance ce qui bloquera (ou non) la clôture réelle.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const exercice = await prisma.exerciceComptable.findUnique({ where: { id: Number(id) } });
    if (!exercice) return NextResponse.json({ error: "Exercice introuvable" }, { status: 404 });

    const etat = await verifierPreCloture(prisma, exercice.annee, Number(session.user.id));
    return NextResponse.json({ data: etat });
  } catch (error) {
    console.error("GET /api/comptable/exercices/[id]/pre-cloture", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
