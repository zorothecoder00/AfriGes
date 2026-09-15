import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { getRVCSession } from "@/lib/authRVC";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genBonReceptionHtml } from "@/lib/bonReceptionHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const br = await prisma.bonReception.findUnique({
      where: { id: Number(id) },
      include: {
        bonSortie: { select: { reference: true } },
        commandeClient: { select: { reference: true, agentId: true } },
        lignes: { include: { produit: { select: { nom: true } } } },
        livreur: { select: { nom: true, prenom: true } },
      },
    });
    if (!br) return NextResponse.json({ error: "Bon de réception introuvable" }, { status: 404 });

    const agent = await getAgentTerrainSession();
    const magasinier = await getMagasinierSession();
    const rvc = await getRVCSession();
    const isAgentProprietaire = !!agent && parseInt(agent.user.id) === br.commandeClient.agentId;
    const isAdmin = !!agent && (agent.user.role === "ADMIN" || agent.user.role === "SUPER_ADMIN");
    if (!isAgentProprietaire && !isAdmin && !magasinier && !rvc) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const qrUrl = qrInstanceUrl(req, "BR", br.id, br.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genBonReceptionHtml({
      reference: br.reference, statut: br.statut,
      commandeReference: br.commandeClient.reference, bonSortieReference: br.bonSortie.reference,
      clientNom: br.clientNom, clientTelephone: br.clientTelephone, clientAdresse: br.clientAdresse,
      lignes: br.lignes.map((l) => ({ produitNom: l.produit.nom, quantiteCommandee: l.quantiteCommandee, quantiteLivree: l.quantiteLivree })),
      etatMarchandise: br.etatMarchandise, reserve: br.reserve,
      signatureClientNom: br.signatureClientNom, dateSignatureClient: br.dateSignatureClient,
      livreur: br.livreur, dateSignatureLivreur: br.dateSignatureLivreur,
      latitudeLivraison: br.latitudeLivraison, longitudeLivraison: br.longitudeLivraison,
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `${br.reference}.pdf`);
  } catch (error) {
    console.error("GET /bons-reception/[id]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
