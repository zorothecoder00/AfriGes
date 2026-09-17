import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionLivraison } from "@/lib/tourneeLivraison";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genFicheTourneeHtml, type VarianteTournee } from "@/lib/ficheTourneeHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";
import { INCLUDE } from "../route";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

const VARIANTES: VarianteTournee[] = ["MISSION", "CHARGEMENT", "BORDEREAU"];

/**
 * GET /api/logistique/tournees/[id]/pdf?variante=MISSION|CHARGEMENT|BORDEREAU
 * Documents de tournée (CDC digitalisation §5.7).
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getSessionLivraison();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const tournee = await prisma.tourneeLivraison.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!tournee) return NextResponse.json({ error: "Tournée introuvable" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const variante = (searchParams.get("variante") as VarianteTournee) || "MISSION";
    if (!VARIANTES.includes(variante)) return NextResponse.json({ error: "Variante invalide" }, { status: 400 });

    const qrUrl = qrInstanceUrl(req, "TRN", tournee.id, tournee.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genFicheTourneeHtml(variante, {
      reference: tournee.reference, statut: tournee.statut, dateTournee: tournee.dateTournee,
      moyenTransport: tournee.moyenTransport, heureDepart: tournee.heureDepart, heureRetour: tournee.heureRetour, notes: tournee.notes,
      livreur: tournee.livreur, pointDeVente: tournee.pointDeVente,
      arrets: tournee.arrets.map((a) => ({
        ordre: a.ordre, statut: a.statut, clientNom: a.clientNom, clientTelephone: a.clientTelephone, adresseLivraison: a.adresseLivraison,
        heureArrivee: a.heureArrivee, motifNonEffectue: a.motifNonEffectue, incidentDescription: a.incidentDescription,
        bonLivraison: a.bonLivraison ? { lignes: a.bonLivraison.lignes } : null,
      })),
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `${variante.toLowerCase()}-${tournee.reference}.pdf`);
  } catch (error) {
    console.error("GET /logistique/tournees/[id]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
