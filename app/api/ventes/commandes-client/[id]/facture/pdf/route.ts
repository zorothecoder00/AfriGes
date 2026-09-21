import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genFactureCommandeClientHtml } from "@/lib/factureCommandeClientHtml";
import { getViewSession, getValideurScope, peutValider } from "../../../route";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/ventes/commandes-client/[id]/facture/pdf
 * Facture de la commande (gabarit AFRISIME), disponible une fois la commande validée (bon de sortie
 * généré). Accessible à l'agent qui a passé la commande, au RVC et à l'admin.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getViewSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const commande = await prisma.commandeClient.findUnique({
      where: { id: Number(id) },
      include: {
        agent: { select: { nom: true, prenom: true } },
        pointDeVente: { select: { nom: true } },
        client: { select: { nom: true, prenom: true, telephone: true, adresse: true } },
        lignes: { include: { produit: { select: { nom: true } } } },
      },
    });
    if (!commande) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

    const isRVCOuAdmin = peutValider(await getValideurScope(), commande.pointDeVenteId);
    if (!isRVCOuAdmin && commande.agentId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (commande.bonSortieId == null) {
      return NextResponse.json({ error: "La facture est disponible une fois la commande validée" }, { status: 422 });
    }

    let logoDataUrl: string | null = null;
    try {
      const buf = await readFile(path.join(process.cwd(), "public", "nouveaulogo.jpeg"));
      logoDataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch { /* logo facultatif : la facture reste valide sans */ }

    const html = genFactureCommandeClientHtml({
      numero: commande.reference.replace(/^BCC-/, "FAC-"),
      commandeReference: commande.reference,
      modeReglement: commande.modeReglement,
      dateEmission: commande.dateVisaResponsable ?? commande.createdAt,
      client: commande.client,
      emisPar: commande.agent,
      pointDeVente: commande.pointDeVente,
      lieuLivraison: commande.lieuLivraison,
      lignes: commande.lignes.map((l) => ({
        designation: l.produit?.nom ?? l.designationLibre ?? "Produit", quantite: l.quantite, prixUnitaire: Number(l.prixUnitaire),
        remiseMontant: Number(l.remiseMontant), montant: Number(l.totalLigne),
      })),
      totalHT: Number(commande.totalHT), totalRemise: Number(commande.totalRemise),
      totalTVA: Number(commande.totalTVA), totalTTC: Number(commande.totalTTC),
      logoDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `${commande.reference.replace(/^BCC-/, "FAC-")}.pdf`);
  } catch (error) {
    console.error("GET /ventes/commandes-client/[id]/facture/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
