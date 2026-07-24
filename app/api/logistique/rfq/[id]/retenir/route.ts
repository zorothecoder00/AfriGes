import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getSession } from "../../../fournisseurs/route";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/logistique/rfq/[id]/retenir
 * Retient le fournisseur choisi (souvent la recommandation système, mais l'agent
 * appro garde la main) et clôture la RFQ. Body: { reponseId }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const demandeId = Number(id);
    const { reponseId } = await req.json();
    if (!reponseId) return NextResponse.json({ error: "reponseId est obligatoire" }, { status: 400 });

    const demande = await prisma.demandeCotation.findUnique({ where: { id: demandeId } });
    if (!demande) return NextResponse.json({ error: "Demande de cotation introuvable" }, { status: 404 });
    if (demande.statut === "CLOTUREE") {
      return NextResponse.json({ error: "Cette RFQ est déjà clôturée" }, { status: 422 });
    }

    const reponse = await prisma.reponseRFQ.findFirst({ where: { id: Number(reponseId), demandeId } });
    if (!reponse) return NextResponse.json({ error: "Réponse introuvable" }, { status: 404 });
    if (reponse.statut !== "RECUE") {
      return NextResponse.json({ error: "Seule une cotation reçue peut être retenue" }, { status: 422 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.reponseRFQ.update({ where: { id: reponse.id }, data: { statut: "RETENUE" } });
      const d = await tx.demandeCotation.update({
        where: { id: demandeId },
        data: { statut: "CLOTUREE", fournisseurRetenuId: reponse.fournisseurId, dateCloture: new Date() },
        include: {
          produit: { select: { id: true, nom: true, codeProduit: true } },
          pointDeVente: { select: { id: true, nom: true, code: true } },
          fournisseurRetenu: { select: { id: true, nom: true, code: true } },
          reponses: { include: { fournisseur: { select: { id: true, nom: true, code: true, email: true, noteGlobale: true } } } },
        },
      });
      await auditLog(tx, parseInt(session.user.id), "RFQ_CLOTUREE", "DemandeCotation", demandeId,
        { fournisseurRetenuId: reponse.fournisseurId });
      return d;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("POST /logistique/rfq/[id]/retenir:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
