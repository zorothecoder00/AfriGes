import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getSession } from "../../fournisseurs/route";
import { comparerCandidatsRFQ, type CandidatRFQ } from "@/lib/rfqComparatif";

type Ctx = { params: Promise<{ id: string }> };

const INCLUDE = {
  produit: { select: { id: true, nom: true, codeProduit: true, uniteAchat: { select: { nom: true } } } },
  pointDeVente: { select: { id: true, nom: true, code: true } },
  fournisseurRetenu: { select: { id: true, nom: true, code: true } },
  reponses: {
    include: { fournisseur: { select: { id: true, nom: true, code: true, email: true, noteGlobale: true } } },
  },
};

/**
 * GET /api/logistique/rfq/[id]
 * Détail d'une RFQ + comparatif automatique des cotations reçues
 * (CDC §7 étape 6 : classement coût/délai/qualité + recommandation).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const demande = await prisma.demandeCotation.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!demande) return NextResponse.json({ error: "Demande de cotation introuvable" }, { status: 404 });

    const candidats: CandidatRFQ[] = demande.reponses
      .filter((r) => r.statut === "RECUE" || r.statut === "RETENUE")
      .filter((r) => r.prixUnitaire != null && r.delaiLivraisonJours != null)
      .map((r) => ({
        fournisseurId: r.fournisseurId,
        prixUnitaire: Number(r.prixUnitaire),
        delaiLivraisonJours: r.delaiLivraisonJours!,
        scoreQualite: r.fournisseur.noteGlobale != null ? Number(r.fournisseur.noteGlobale) : null,
      }));

    const comparatif = comparerCandidatsRFQ(candidats);

    return NextResponse.json({ data: demande, comparatif });
  } catch (error) {
    console.error("GET /logistique/rfq/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/logistique/rfq/[id]
 * Édition (notes, date limite) ou annulation.
 * Body: { notes?, dateLimiteReponse?, action?: "ANNULER" }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const demandeId = Number(id);
    const existing = await prisma.demandeCotation.findUnique({ where: { id: demandeId } });
    if (!existing) return NextResponse.json({ error: "Demande de cotation introuvable" }, { status: 404 });

    const body = await req.json();

    if (body.action === "ANNULER") {
      if (existing.statut === "CLOTUREE") {
        return NextResponse.json({ error: "Une RFQ clôturée ne peut plus être annulée" }, { status: 422 });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const d = await tx.demandeCotation.update({ where: { id: demandeId }, data: { statut: "ANNULEE" }, include: INCLUDE });
        await auditLog(tx, parseInt(session.user.id), "RFQ_ANNULEE", "DemandeCotation", demandeId);
        return d;
      });
      return NextResponse.json({ data: updated });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if ("notes" in body) data.notes = body.notes || null;
    if ("dateLimiteReponse" in body) data.dateLimiteReponse = body.dateLimiteReponse ? new Date(body.dateLimiteReponse) : null;
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });

    const updated = await prisma.demandeCotation.update({ where: { id: demandeId }, data, include: INCLUDE });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /logistique/rfq/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
