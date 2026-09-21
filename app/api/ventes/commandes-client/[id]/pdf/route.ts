import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genCommandeClientHtml } from "@/lib/commandeClientHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";
import { getViewSession, getValideurScope, peutValider } from "../../route";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getViewSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const commande = await prisma.commandeClient.findUnique({
      where: { id: Number(id) },
      include: {
        agent: { select: { nom: true, prenom: true } },
        pointDeVente: { select: { nom: true, code: true } },
        client: { select: { nom: true, prenom: true, telephone: true, adresse: true } },
        visaResponsablePar: { select: { nom: true, prenom: true } },
        lignes: { include: { produit: { select: { nom: true } } } },
      },
    });
    if (!commande) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

    const isRVCOuAdmin = peutValider(await getValideurScope(), commande.pointDeVenteId);
    if (!isRVCOuAdmin && commande.agentId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const qrUrl = qrInstanceUrl(req, "BCC", commande.id, commande.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genCommandeClientHtml({
      reference: commande.reference, statut: commande.statut,
      agent: commande.agent, pointDeVente: commande.pointDeVente, client: commande.client,
      modeReglement: commande.modeReglement, typeClientCommande: commande.typeClientCommande,
      dateLivraisonSouhaitee: commande.dateLivraisonSouhaitee, lieuLivraison: commande.lieuLivraison,
      lignes: commande.lignes.map((l) => ({ produitNom: l.produit.nom, quantite: l.quantite, prixUnitaire: Number(l.prixUnitaire), remiseMontant: Number(l.remiseMontant), totalLigne: Number(l.totalLigne) })),
      totalHT: Number(commande.totalHT), totalRemise: Number(commande.totalRemise), totalTVA: Number(commande.totalTVA), totalTTC: Number(commande.totalTTC),
      signatureClientNom: commande.signatureClientNom, dateSignatureClient: commande.dateSignatureClient,
      visaResponsablePar: commande.visaResponsablePar, dateVisaResponsable: commande.dateVisaResponsable,
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `${commande.reference}.pdf`);
  } catch (error) {
    console.error("GET /ventes/commandes-client/[id]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
