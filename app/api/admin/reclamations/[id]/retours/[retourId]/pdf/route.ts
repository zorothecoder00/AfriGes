import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReclamationSession } from "@/lib/authReclamation";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { resolvePdvIdsAutorises } from "@/lib/reclamationClientServer";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genFicheRetourMarchandiseHtml } from "@/lib/ficheRetourMarchandiseHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string; retourId: string }> };

/**
 * GET /api/admin/reclamations/[id]/retours/[retourId]/pdf
 * Fiche de retour marchandise, devient le Bon de retour une fois validée
 * (CDC digitalisation §5.8). Accessible au Service Commercial (RPV/Chef
 * d'agence/Admin) comme au Magasinier qui l'exécute.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const reclamationSession = await getReclamationSession();
    const magasinierSession = reclamationSession ? null : await getMagasinierSession();
    const session = reclamationSession ?? magasinierSession;
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, retourId } = await params;
    const retour = await prisma.retourMarchandiseClient.findUnique({
      where: { id: Number(retourId) },
      include: {
        pointDeVente: { select: { nom: true, code: true } },
        reclamation: { select: { id: true, numero: true, objet: true, pointDeVenteId: true, client: { select: { nom: true, prenom: true } } } },
        magasinier: { select: { nom: true, prenom: true } },
        lignes: { include: { produit: { select: { nom: true } } } },
      },
    });
    if (!retour || retour.reclamation.id !== Number(id)) return NextResponse.json({ error: "Retour introuvable" }, { status: 404 });

    if (reclamationSession) {
      const pdvIds = await resolvePdvIdsAutorises(reclamationSession);
      if (pdvIds !== null && (!retour.reclamation.pointDeVenteId || !pdvIds.includes(retour.reclamation.pointDeVenteId))) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const qrUrl = qrInstanceUrl(req, "RET", retour.id, retour.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genFicheRetourMarchandiseHtml({
      numero: retour.numero, statut: retour.statut, dateReception: retour.dateReception, motifRejet: retour.motifRejet,
      pointDeVente: retour.pointDeVente, reclamation: retour.reclamation, magasinier: retour.magasinier,
      lignes: retour.lignes.map((l) => ({ produit: l.produit, quantite: l.quantite, etatProduit: l.etatProduit })),
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `retour-${retour.numero}.pdf`);
  } catch (error) {
    console.error("GET /admin/reclamations/[id]/retours/[retourId]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
