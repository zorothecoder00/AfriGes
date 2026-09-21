import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/authAdmin";
import { prisma } from "@/lib/prisma";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genBonSortieHtml } from "@/lib/bonSortieHtml";

// Chromium nécessite le runtime Node (pas Edge) ; génération potentiellement longue.
export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/stock/journal-sorties/[id]/pdf
 * Bon de sortie imprimable d'un mouvement de stock (id = MouvementStock).
 *  - mouvement rattaché à un BonSortie → renvoie le PDF de ce bon ;
 *  - sinon (vente directe, livraison pack/crédit…) → génère un bon de sortie à partir du mouvement.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const m = await prisma.mouvementStock.findUnique({
      where: { id: Number(id) },
      include: {
        produit: { select: { nom: true, prixUnitaire: true } },
        pointDeVente: { select: { nom: true, code: true } },
        operateur: { select: { nom: true, prenom: true } },
      },
    });
    if (!m || m.type !== "SORTIE") return NextResponse.json({ error: "Sortie de stock introuvable" }, { status: 404 });

    if (m.bonSortieId) {
      return NextResponse.redirect(new URL(`/api/magasinier/bons-sortie/${m.bonSortieId}/pdf`, req.url));
    }

    // Source commerciale (facultative) pour la traçabilité sur le document.
    const vente = m.venteDirecteId
      ? await prisma.venteDirecte.findUnique({ where: { id: m.venteDirecteId }, select: { reference: true } })
      : null;
    const sources = [
      vente ? `Vente ${vente.reference}` : null,
      m.souscriptionId ? `Souscription pack #${m.souscriptionId}` : null,
    ].filter(Boolean).join(" · ");

    const prixUnit = m.prixUnitaire != null ? Number(m.prixUnitaire) : Number(m.produit.prixUnitaire ?? 0);
    const operateur = m.operateur ?? { nom: "Système", prenom: "" };

    const html = genBonSortieHtml({
      reference: m.reference,
      statut: "VALIDE",
      typeSortie: m.typeSortie ?? "VENTE_DIRECTE",
      motif: m.motif ?? "Sortie de stock",
      notes: `Document généré à partir du mouvement de stock (sortie sans bon préalable).${sources ? ` Source : ${sources}.` : ""}`,
      commentaireEcart: null,
      pointDeVente: m.pointDeVente ?? { nom: "—", code: "—" },
      lignes: [{ produitNom: m.produit.nom, quantiteDemandee: null, quantite: m.quantite, prixUnit: prixUnit || null }],
      montantTotal: prixUnit ? prixUnit * m.quantite : null,
      creePar: operateur,
      validePar: operateur,
      dateValidation: m.dateMouvement,
      visePar: null,
      dateVisa: null,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `${m.reference}.pdf`);
  } catch (error) {
    console.error("GET /admin/stock/journal-sorties/[id]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
