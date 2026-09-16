import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { getRVCSession } from "@/lib/authRVC";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genBonLivraisonHtml } from "@/lib/bonLivraisonHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const bl = await prisma.bonLivraison.findUnique({
      where: { id: Number(id) },
      include: {
        bonSortie: { select: { reference: true } },
        commandeClient: { select: { reference: true, agentId: true } },
        lignes: { include: { produit: { select: { nom: true } } } },
        livreur: { select: { nom: true, prenom: true } },
      },
    });
    if (!bl) return NextResponse.json({ error: "Bon de livraison introuvable" }, { status: 404 });

    const agent = await getAgentTerrainSession();
    const magasinier = await getMagasinierSession();
    const rvc = await getRVCSession();
    const isAgentProprietaire = !!agent && parseInt(agent.user.id) === bl.commandeClient.agentId;
    const isAdmin = !!agent && (agent.user.role === "ADMIN" || agent.user.role === "SUPER_ADMIN");
    if (!isAgentProprietaire && !isAdmin && !magasinier && !rvc) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const qrUrl = qrInstanceUrl(req, "BL", bl.id, bl.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genBonLivraisonHtml({
      reference: bl.reference,
      commandeReference: bl.commandeClient.reference, bonSortieReference: bl.bonSortie.reference,
      clientNom: bl.clientNom, clientTelephone: bl.clientTelephone, adresseLivraison: bl.adresseLivraison,
      lignes: bl.lignes.map((l) => ({ produitNom: l.produit.nom, quantite: l.quantite })),
      livreur: bl.livreur, moyenTransport: bl.moyenTransport, dateDepart: bl.dateDepart,
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `${bl.reference}.pdf`);
  } catch (error) {
    console.error("GET /bons-livraison/[id]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
