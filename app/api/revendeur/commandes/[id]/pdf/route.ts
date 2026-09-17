import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRevendeurSession } from "@/lib/authRevendeur";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genBonCommandeRevendeurHtml } from "@/lib/bonCommandeRevendeurHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/revendeur/commandes/[id]/pdf — Bon de commande revendeur (self-service, CDC §5.6). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getRevendeurSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const { id } = await params;
    const commande = await prisma.commandeRevendeur.findUnique({
      where: { id: Number(id) },
      include: { pointDeVente: { select: { nom: true, code: true } }, lignes: { include: { produit: { select: { nom: true, codeProduit: true } } } }, revendeur: { select: { nom: true, prenom: true } } },
    });
    if (!commande || commande.revendeurId !== userId) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

    const profil = await prisma.profilRevendeur.findUnique({ where: { userId }, select: { raisonSociale: true } });

    const qrUrl = qrInstanceUrl(req, "BCR", commande.id, commande.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genBonCommandeRevendeurHtml({
      id: commande.id, reference: commande.reference, statut: commande.statut,
      raisonSociale: profil?.raisonSociale ?? `${commande.revendeur.prenom} ${commande.revendeur.nom}`,
      pointDeVente: commande.pointDeVente, lignes: commande.lignes.map((l) => ({ quantite: l.quantite, prixUnitaire: Number(l.prixUnitaire), montantLigne: Number(l.montantLigne), produit: l.produit })),
      totalTTC: Number(commande.totalTTC), dateLivraisonSouhaitee: commande.dateLivraisonSouhaitee, notes: commande.notes, createdAt: commande.createdAt, qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `${commande.reference}.pdf`);
  } catch (error) {
    console.error("GET /revendeur/commandes/[id]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
