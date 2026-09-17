import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRevendeurSession } from "@/lib/authRevendeur";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genBonLivraisonRevendeurHtml } from "@/lib/bonLivraisonRevendeurHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/revendeur/commandes/[id]/bon-livraison/pdf — Bon de livraison revendeur (self-service, CDC §5.6). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getRevendeurSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const { id } = await params;
    const commande = await prisma.commandeRevendeur.findUnique({
      where: { id: Number(id) },
      include: { bonLivraison: { include: { lignes: { include: { produit: { select: { nom: true, codeProduit: true } } } }, livreur: { select: { nom: true, prenom: true } } } } },
    });
    if (!commande || commande.revendeurId !== userId) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    if (!commande.bonLivraison) return NextResponse.json({ error: "Aucun bon de livraison pour cette commande" }, { status: 404 });

    const profil = await prisma.profilRevendeur.findUnique({ where: { userId }, select: { raisonSociale: true } });

    const bl = commande.bonLivraison;
    const qrUrl = qrInstanceUrl(req, "BLR", bl.id, bl.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genBonLivraisonRevendeurHtml({
      reference: bl.reference, dateDepart: bl.dateDepart, notes: bl.notes, livreur: bl.livreur,
      lignes: bl.lignes.map((l) => ({ quantite: l.quantite, produit: l.produit })),
      raisonSociale: profil?.raisonSociale ?? "", commandeReference: commande.reference, qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `${bl.reference}.pdf`);
  } catch (error) {
    console.error("GET /revendeur/commandes/[id]/bon-livraison/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
