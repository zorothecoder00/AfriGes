import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { contrepasserEcriture } from "@/lib/comptabilite/moteur";

type Ctx = { params: Promise<{ id: string }> };

const MESSAGES: Record<string, [string, number]> = {
  ÉCRITURE_INTROUVABLE: ["Écriture introuvable", 404],
  SEULES_LES_ECRITURES_VALIDEES_PEUVENT_ETRE_CONTREPASSEES: [
    "Seules les écritures validées ou clôturées peuvent être contrepassées", 422,
  ],
  DEJA_CONTREPASSEE: ["Cette écriture a déjà été contrepassée", 422],
};

/**
 * POST /api/comptable/ecritures/[id]/contrepasser
 * Génère l'écriture inverse d'une écriture validée (CDC §13) — n'annule ni ne
 * modifie jamais l'écriture d'origine, dont l'historique reste intact.
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const ecritureId = Number(id);
    if (isNaN(ecritureId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId = Number(session.user.id);

    const nouvelleId = await prisma.$transaction((tx) => contrepasserEcriture(tx, ecritureId, userId));

    const nouvelle = await prisma.ecritureComptable.findUnique({
      where: { id: nouvelleId },
      include: { lignes: { include: { compte: { select: { numero: true, libelle: true } } } } },
    });

    return NextResponse.json({ data: nouvelle }, { status: 201 });
  } catch (error) {
    console.error("POST /api/comptable/ecritures/[id]/contrepasser", error);
    if (error instanceof Error && MESSAGES[error.message]) {
      const [message, status] = MESSAGES[error.message];
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
