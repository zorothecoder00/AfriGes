import { NextResponse } from "next/server";
import { StatutCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";
import { appliquerNouvelleDureeCredit } from "@/lib/dureeCredit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/caissier/credits/[id]
 * Modifie la durée / date de début d'un crédit du périmètre du caissier (son PDV).
 * Régénère l'échéancier en réimputant le déjà-payé (cf. appliquerNouvelleDureeCredit).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = parseInt(id);
    if (isNaN(creditId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);
    if (!isAdmin && !pdvId) return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });

    const body = await req.json() as { dureeJours?: number; dateDebut?: string; garantie?: string | null; observations?: string | null };

    const result = await prisma.$transaction(async (tx) => {
      const credit = await tx.creditClient.findUnique({
        where: { id: creditId },
        select: {
          id: true, statut: true, montantTotal: true, montantRembourse: true, dureeJours: true, dateDebut: true,
          client: { select: { pointDeVenteId: true } },
        },
      });
      if (!credit) throw new Error("CREDIT_INTROUVABLE");
      if (pdvId !== null && credit.client.pointDeVenteId !== pdvId) throw new Error("ACCES_REFUSE");
      const modifiable =
        credit.statut === StatutCredit.EN_ATTENTE_VALIDATION ||
        credit.statut === StatutCredit.ACTIF ||
        credit.statut === StatutCredit.EN_RETARD;
      if (!modifiable) throw new Error("CREDIT_NON_MODIFIABLE");

      return appliquerNouvelleDureeCredit(tx, credit, body);
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CREDIT_INTROUVABLE:    ["Crédit introuvable", 404],
        ACCES_REFUSE:          ["Ce crédit n'appartient pas à votre point de vente", 403],
        CREDIT_NON_MODIFIABLE: ["Seuls les crédits en attente de validation, actifs ou en retard peuvent être modifiés", 422],
        DUREE_INVALIDE:        ["La durée doit être ≥ 1 jour", 400],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ error: msg }, { status });
      }
    }
    console.error("PATCH /api/caissier/credits/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
