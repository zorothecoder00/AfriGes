import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ token: string }> };

/**
 * GET /api/livraison/[token]
 * Accès SANS login (CDC digitalisation §3.5) — le client ouvre ce lien pour
 * consulter et confirmer sa livraison. Le jeton fait office de clé.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { token } = await params;
    const br = await prisma.bonReception.findUnique({
      where: { tokenConfirmation: token },
      include: {
        lignes: { include: { produit: { select: { nom: true } } } },
        bonSortie: { select: { reference: true } },
        commandeClient: { select: { reference: true, pointDeVente: { select: { nom: true } } } },
      },
    });
    if (!br) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });

    return NextResponse.json({
      data: {
        reference: br.reference,
        statut: br.statut,
        clientNom: br.clientNom,
        clientAdresse: br.clientAdresse,
        pointDeVenteNom: br.commandeClient.pointDeVente.nom,
        commandeReference: br.commandeClient.reference,
        lignes: br.lignes.map((l) => ({ produitId: l.produitId, produitNom: l.produit.nom, quantiteCommandee: l.quantiteCommandee, quantiteLivree: l.quantiteLivree })),
        etatMarchandise: br.etatMarchandise,
        reserve: br.reserve,
        signatureClientNom: br.signatureClientNom,
        dateSignatureClient: br.dateSignatureClient,
      },
    });
  } catch (error) {
    console.error("GET /livraison/[token]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
