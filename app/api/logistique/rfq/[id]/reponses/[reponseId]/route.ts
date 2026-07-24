import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getSession } from "../../../../fournisseurs/route";

type Ctx = { params: Promise<{ id: string; reponseId: string }> };

/**
 * PATCH /api/logistique/rfq/[id]/reponses/[reponseId]
 * Saisie de la cotation reçue d'un fournisseur (téléphone, email…).
 * Body: { prixUnitaire, delaiLivraisonJours, notes? } → statut RECUE
 *    ou { statut: "REJETEE", notes? } pour écarter un fournisseur sans cotation.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, reponseId } = await params;
    const reponse = await prisma.reponseRFQ.findFirst({
      where: { id: Number(reponseId), demandeId: Number(id) },
    });
    if (!reponse) return NextResponse.json({ error: "Réponse introuvable" }, { status: 404 });

    const body = await req.json();

    if (body.statut === "REJETEE") {
      const updated = await prisma.reponseRFQ.update({
        where: { id: reponse.id },
        data: { statut: "REJETEE", notes: body.notes || reponse.notes },
      });
      return NextResponse.json({ data: updated });
    }

    const { prixUnitaire, delaiLivraisonJours, notes } = body;
    if (prixUnitaire == null || prixUnitaire <= 0 || delaiLivraisonJours == null || delaiLivraisonJours < 0) {
      return NextResponse.json({ error: "prixUnitaire (>0) et delaiLivraisonJours (≥0) sont obligatoires" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.reponseRFQ.update({
        where: { id: reponse.id },
        data: {
          statut: "RECUE",
          prixUnitaire: Number(prixUnitaire),
          delaiLivraisonJours: Number(delaiLivraisonJours),
          notes: notes || null,
          dateReponse: new Date(),
        },
      });
      // La RFQ passe en REPONSES_RECUES dès la première cotation saisie.
      await tx.demandeCotation.updateMany({
        where: { id: Number(id), statut: { in: ["ENVOYEE"] } },
        data: { statut: "REPONSES_RECUES" },
      });
      await auditLog(tx, parseInt(session.user.id), "RFQ_COTATION_SAISIE", "ReponseRFQ", r.id);
      return r;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /logistique/rfq/[id]/reponses/[reponseId]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
