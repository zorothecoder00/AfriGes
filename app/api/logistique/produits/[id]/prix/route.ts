import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { calculerMarge } from "@/lib/prixProduit";

type Ctx = { params: Promise<{ id: string }> };

/** Lecture historique prix → admin + tout gestionnaire authentifié. */
async function getReadSession() {
  const s = await getAuthSession();
  if (!s) return null;
  if (s.user.role === "ADMIN" || s.user.role === "SUPER_ADMIN") return s;
  if (s.user.gestionnaireRole) return s;
  return null;
}

/**
 * GET /api/logistique/produits/[id]/prix
 * Historique daté des prix (achat & vente) d'un produit, avec marge calculée.
 * Consultation ouverte à Admin, Appro/Logistique, Magasinier, etc.
 * Query: limit (défaut 200).
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getReadSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") || 200)));

    const produit = await prisma.produit.findUnique({
      where: { id: Number(id) },
      select: { id: true, nom: true, reference: true, unite: true, prixUnitaire: true, prixAchat: true },
    });
    if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    const entries = await prisma.historiquePrixProduit.findMany({
      where:   { produitId: Number(id) },
      orderBy: { dateEffet: "desc" },
      take:    limit,
      include: { creePar: { select: { id: true, nom: true, prenom: true } } },
    });

    const data = entries.map((e) => {
      const prixVente = Number(e.prixVente);
      const prixAchat = e.prixAchat !== null ? Number(e.prixAchat) : null;
      const marge = calculerMarge(prixVente, prixAchat);
      return {
        id:               e.id,
        prixVente,
        prixAchat,
        margeValeur:      marge?.valeur ?? (e.marge !== null ? Number(e.marge) : null),
        margeTaux:        marge?.taux ?? null,
        type:             e.type,
        source:           e.source,
        motif:            e.motif,
        receptionApproId: e.receptionApproId,
        dateEffet:        e.dateEffet,
        creePar:          e.creePar,
      };
    });

    const margeCourante = calculerMarge(
      Number(produit.prixUnitaire),
      produit.prixAchat !== null ? Number(produit.prixAchat) : null,
    );

    return NextResponse.json({
      data,
      produit: {
        id:           produit.id,
        nom:          produit.nom,
        reference:    produit.reference,
        unite:        produit.unite,
        prixUnitaire: Number(produit.prixUnitaire),
        prixAchat:    produit.prixAchat !== null ? Number(produit.prixAchat) : null,
        margeValeur:  margeCourante?.valeur ?? null,
        margeTaux:    margeCourante?.taux ?? null,
      },
    });
  } catch (error) {
    console.error("GET /logistique/produits/[id]/prix:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
