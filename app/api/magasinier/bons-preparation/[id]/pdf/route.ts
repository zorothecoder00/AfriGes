import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { getRVCSession } from "@/lib/authRVC";
import { htmlToPdf, pdfResponse, PDF_A5_PAYSAGE } from "@/lib/pdf";
import { genBonPreparationHtml } from "@/lib/bonPreparationHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const bp = await prisma.bonPreparation.findUnique({
      where: { id: Number(id) },
      include: {
        bonSortie: { select: { reference: true } },
        commandeClient: { select: { reference: true, agentId: true } },
        lignes: { include: { produit: { select: { nom: true } } } },
        preparateur: { select: { nom: true, prenom: true } },
      },
    });
    if (!bp) return NextResponse.json({ error: "Bon de préparation introuvable" }, { status: 404 });

    const magasinier = await getMagasinierSession();
    const rvc = await getRVCSession();
    const agent = await getAgentTerrainSession();
    const isAgentProprietaire = !!agent && parseInt(agent.user.id) === bp.commandeClient.agentId;
    const isAdmin = !!agent && (agent.user.role === "ADMIN" || agent.user.role === "SUPER_ADMIN");
    if (!magasinier && !rvc && !isAgentProprietaire && !isAdmin) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const qrUrl = qrInstanceUrl(req, "BP", bp.id, bp.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genBonPreparationHtml({
      reference: bp.reference, statut: bp.statut,
      commandeReference: bp.commandeClient.reference, bonSortieReference: bp.bonSortie.reference,
      lignes: bp.lignes.map((l) => ({ produitNom: l.produit.nom, quantiteDemandee: l.quantiteDemandee, quantitePreparee: l.quantitePreparee })),
      preparateur: bp.preparateur, datePreparation: bp.datePreparation,
      commentaireEcart: bp.commentaireEcart,
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html, PDF_A5_PAYSAGE);
    return pdfResponse(pdf, `${bp.reference}.pdf`);
  } catch (error) {
    console.error("GET /magasinier/bons-preparation/[id]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
