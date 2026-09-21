import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { getRPVSession } from "@/lib/authRPV";
import { getAuthSession } from "@/lib/auth";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genBonSortieHtml } from "@/lib/bonSortieHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

// Chromium nécessite le runtime Node (pas Edge) ; génération potentiellement longue.
export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/magasinier/bons-sortie/[id]/pdf
 * Accusé de sortie imprimable (PDF) — CDC digitalisation §3.4.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    let session = (await getMagasinierSession()) ?? (await getRPVSession());
    if (!session) {
      // L'agent qui a passé la commande client peut télécharger le bon de sortie généré.
      const s = await getAuthSession();
      const commande = s ? await prisma.commandeClient.findFirst({ where: { bonSortieId: Number(id), agentId: parseInt(s.user.id) }, select: { id: true } }) : null;
      if (commande) session = s;
    }
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const bon = await prisma.bonSortie.findUnique({
      where: { id: Number(id) },
      include: {
        pointDeVente: { select: { nom: true, code: true } },
        creePar: { select: { nom: true, prenom: true } },
        validePar: { select: { nom: true, prenom: true } },
        visePar: { select: { nom: true, prenom: true } },
        lignes: { include: { produit: { select: { nom: true } } } },
      },
    });
    if (!bon) return NextResponse.json({ error: "Bon de sortie introuvable" }, { status: 404 });

    const qrUrl = qrInstanceUrl(req, "BSM", bon.id, bon.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genBonSortieHtml({
      reference: bon.reference, statut: bon.statut, typeSortie: bon.typeSortie, motif: bon.motif, notes: bon.notes,
      commentaireEcart: bon.commentaireEcart,
      pointDeVente: bon.pointDeVente,
      lignes: bon.lignes.map((l) => ({
        produitNom: l.produit.nom, quantiteDemandee: l.quantiteDemandee, quantite: l.quantite,
        prixUnit: l.prixUnit != null ? Number(l.prixUnit) : null,
      })),
      montantTotal: bon.montantTotal != null ? Number(bon.montantTotal) : null,
      creePar: bon.creePar, validePar: bon.validePar, dateValidation: bon.dateValidation,
      visePar: bon.visePar, dateVisa: bon.dateVisa,
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `${bon.reference}.pdf`);
  } catch (error) {
    console.error("GET /magasinier/bons-sortie/[id]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
