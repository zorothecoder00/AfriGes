import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ token: string }> };

/**
 * GET /api/offres/[token]
 * Accès SANS login (CDC digitalisation §5.2) — le client consulte un devis ou
 * une proforma et y répond via le jeton opaque contenu dans le lien reçu.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { token } = await params;
    const doc = await prisma.devisProforma.findUnique({
      where: { tokenReponse: token },
      include: {
        lignes: { include: { produit: { select: { nom: true } } } },
        pointDeVente: { select: { nom: true } },
        client: { select: { nom: true, prenom: true } },
      },
    });
    if (!doc) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });

    const expire = doc.statut === "ENVOYE" && doc.dateValidite < new Date();

    return NextResponse.json({
      data: {
        reference: doc.reference,
        type: doc.type,
        statut: expire ? "EXPIRE" : doc.statut,
        clientNom: `${doc.client.prenom} ${doc.client.nom}`,
        pointDeVenteNom: doc.pointDeVente.nom,
        dateValidite: doc.dateValidite,
        conditions: doc.conditions,
        lignes: doc.lignes.map((l) => ({ produitNom: l.produit.nom, quantite: l.quantite, prixUnitaire: Number(l.prixUnitaire), totalLigne: Number(l.totalLigne) })),
        totalHT: Number(doc.totalHT), totalRemise: Number(doc.totalRemise), totalTVA: Number(doc.totalTVA), totalTTC: Number(doc.totalTTC),
        nomSignataireReponse: doc.nomSignataireReponse,
        motifRefus: doc.motifRefus,
      },
    });
  } catch (error) {
    console.error("GET /offres/[token]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
