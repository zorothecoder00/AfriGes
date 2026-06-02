import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getAdminSession } from "@/lib/authAdmin";

async function getSession() {
  const logistique = await getLogistiqueSession();
  if (logistique) return logistique;
  const admin = await getAdminSession();
  if (admin) return admin;
  return null;
}

/**
 * GET /api/logistique/previsions
 * Agrège les lignes CONFIRME par (produit × PDV) pour alimenter les prévisions d'approvisionnement.
 *
 * Query:
 *   pdvId?      — filtre par point de vente
 *   produitId?  — filtre par produit
 *   packType?   — filtre par type de pack (ALIMENTAIRE, etc.)
 *
 * Retourne:
 *   previsions[]  — agrégat par produit × PDV
 *   pdvs[]        — liste des PDVs concernés (pour les filtres UI)
 *   stats         — totalProduits, totalQuantite, totalPdvs
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const produitId = searchParams.get("produitId") ? parseInt(searchParams.get("produitId")!) : null;
    const packType  = searchParams.get("packType") ?? null;

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const userId  = parseInt(session.user.id);

    // Pour non-admin : force le filtre sur leur PDV (ignorer le pdvId query param)
    // Pour admin : le pdvId query param est optionnel
    let pdvId: number | null = isAdmin && searchParams.get("pdvId")
      ? parseInt(searchParams.get("pdvId")!)
      : null;

    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (aff) pdvId = aff.pointDeVenteId;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { statut: "CONFIRME", produitId: { not: null } };
    if (pdvId)     where.pointDeVenteId = pdvId;
    if (produitId) where.produitId      = produitId;
    if (packType)  where.souscription   = { pack: { type: packType } };

    // Agrégation par (produitId, pointDeVenteId)
    const agregats = await prisma.ligneSouscriptionProduit.groupBy({
      by: ["produitId", "pointDeVenteId"],
      where,
      _sum:   { quantite: true, prixEstime: true },
      _count: { souscriptionId: true },
      orderBy: [{ pointDeVenteId: "asc" }],
    });

    if (agregats.length === 0) {
      return NextResponse.json({ previsions: [], pdvs: [], stats: { totalProduits: 0, totalQuantite: 0, totalPdvs: 0 } });
    }

    // Charger les noms produits + PDVs en une seule passe
    const produitIds = [...new Set(agregats.map(a => a.produitId!))];
    const pdvIds     = [...new Set(agregats.map(a => a.pointDeVenteId).filter(Boolean) as number[])];

    // Exclure les combinaisons (produit × PDV) déjà couvertes par une réception interne en cours
    const lignesActives = await prisma.ligneReceptionAppro.findMany({
      where: {
        produitId: { in: produitIds },
        reception: {
          type:   "INTERNE",
          statut: { in: ["BROUILLON", "EN_COURS", "RECU"] },
        },
      },
      select: { produitId: true, reception: { select: { pointDeVenteId: true } } },
    });
    const dejaCommandeSet = new Set(lignesActives.map(l => `${l.produitId}_${l.reception.pointDeVenteId}`));

    const agregatsFiltered = agregats.filter(a => {
      const key = `${a.produitId}_${a.pointDeVenteId ?? null}`;
      return !dejaCommandeSet.has(key);
    });

    if (agregatsFiltered.length === 0) {
      return NextResponse.json({ previsions: [], pdvs: [], stats: { totalProduits: 0, totalQuantite: 0, totalPdvs: 0 } });
    }

    const [produits, pdvs] = await Promise.all([
      prisma.produit.findMany({
        where: { id: { in: produitIds } },
        select: { id: true, nom: true, unite: true, prixUnitaire: true, reference: true },
      }),
      prisma.pointDeVente.findMany({
        where: { id: { in: pdvIds } },
        select: { id: true, nom: true, code: true },
      }),
    ]);

    const produitMap = Object.fromEntries(produits.map(p => [p.id, p]));
    const pdvMap     = Object.fromEntries(pdvs.map(p => [p.id, p]));

    const previsions = agregatsFiltered.map(a => ({
      produitId:       a.produitId,
      produit:         produitMap[a.produitId!] ?? null,
      pointDeVenteId:  a.pointDeVenteId,
      pointDeVente:    a.pointDeVenteId ? pdvMap[a.pointDeVenteId] ?? null : null,
      totalQuantite:   a._sum.quantite    ?? 0,
      totalEstime:     Number(a._sum.prixEstime ?? 0),
      nbSouscriptions: a._count.souscriptionId,
    }));

    const filteredProduitIds = [...new Set(agregatsFiltered.map(a => a.produitId!))];
    const filteredPdvIds     = [...new Set(agregatsFiltered.map(a => a.pointDeVenteId).filter(Boolean) as number[])];

    const stats = {
      totalProduits: filteredProduitIds.length,
      totalQuantite: previsions.reduce((s, p) => s + p.totalQuantite, 0),
      totalPdvs:     filteredPdvIds.length,
    };

    return NextResponse.json({ previsions, pdvs, stats });
  } catch (error) {
    console.error("GET /api/logistique/previsions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
