import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "../../../fournisseurs/route";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genBonCommandeHtml } from "@/lib/bonCommandeHtml";

// Chromium nécessite le runtime Node (pas Edge) ; génération potentiellement longue.
export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/logistique/bons-commande/[id]/pdf
 * Bon de commande imprimable (PDF).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const bon = await prisma.bonCommande.findUnique({
      where: { id: Number(id) },
      include: {
        fournisseur: { select: { nom: true, code: true, adresse: true, contact: true, telephone: true, email: true } },
        pointDeVente: { select: { nom: true, code: true } },
        signePar: { select: { nom: true, prenom: true } },
        lignes: { include: { produit: { select: { nom: true } } } },
      },
    });
    if (!bon) return NextResponse.json({ error: "Bon de commande introuvable" }, { status: 404 });

    const html = genBonCommandeHtml({
      reference: bon.reference, statut: bon.statut, devise: bon.devise,
      dateCommande: bon.dateCommande, dateLivraisonPrevue: bon.dateLivraisonPrevue, notes: bon.notes,
      fournisseur: bon.fournisseur, pointDeVente: bon.pointDeVente,
      lignes: bon.lignes.map((l) => ({ produitNom: l.produit.nom, quantite: l.quantite, prixUnitaire: Number(l.prixUnitaire) })),
      montantTotal: Number(bon.montantTotal),
      signePar: bon.signePar, dateSignature: bon.dateSignature,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `${bon.reference}.pdf`);
  } catch (error) {
    console.error("GET /logistique/bons-commande/[id]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
