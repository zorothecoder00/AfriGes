import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genFactureRevendeurHtml } from "@/lib/factureRevendeurHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string; commandeId: string }> };

/** GET /api/admin/revendeurs/[id]/commandes/[commandeId]/facture/pdf — Facture revendeur (CDC §5.6). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, commandeId } = await params;
    const profil = await prisma.profilRevendeur.findUnique({ where: { id: Number(id) }, select: { userId: true } });
    if (!profil) return NextResponse.json({ error: "Revendeur introuvable" }, { status: 404 });

    const commande = await prisma.commandeRevendeur.findUnique({
      where: { id: Number(commandeId) },
      include: { facture: { include: { lignes: true } } },
    });
    if (!commande || commande.revendeurId !== profil.userId) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    if (!commande.facture) return NextResponse.json({ error: "Aucune facture pour cette commande" }, { status: 404 });

    const f = commande.facture;
    const qrUrl = qrInstanceUrl(req, "FRV", f.id, f.dateEmission.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genFactureRevendeurHtml({
      numero: f.numero, statut: f.statut, clientNom: f.clientNom, clientTelephone: f.clientTelephone,
      montantHT: Number(f.montantHT), montantTVA: Number(f.montantTVA), montantTTC: Number(f.montantTTC), montantPaye: Number(f.montantPaye),
      dateEmission: f.dateEmission, emiseParNom: f.emiseParNom,
      lignes: f.lignes.map((l) => ({ designation: l.designation, quantite: l.quantite, prixUnitaire: Number(l.prixUnitaire), montant: Number(l.montant) })),
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `${f.numero}.pdf`);
  } catch (error) {
    console.error("GET /admin/revendeurs/[id]/commandes/[commandeId]/facture/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
