import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { getAuthSession } from "@/lib/auth";
import { resolveViewAs } from "@/lib/viewAs";

async function getSession() {
  const logistique = await getLogistiqueSession();
  if (logistique) return logistique;
  const magasinier = await getMagasinierSession();
  if (magasinier) return magasinier;
  const s = await getAuthSession();
  if (s && (s.user.role === "ADMIN" || s.user.role === "SUPER_ADMIN")) return s;
  return null;
}

/**
 * GET /api/logistique/stock
 * Vue stock par PDV pour l'agent logistique / magasinier.
 * - Pour les non-admins, auto-détecte le PDV de l'utilisateur via GestionnaireAffectation.
 * - Retourne une liste aplatie { id: produitId, nom, stock: quantite, ... } pour compat pages.
 * Query: pdvId (override), search, enRupture (bool), page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page      = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit     = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip      = (page - 1) * limit;
    const search    = searchParams.get("search")   || "";
    const pdvIdQ    = searchParams.get("pdvId");
    const enRupture = searchParams.get("enRupture") === "true";

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const viewAs  = isAdmin ? resolveViewAs(req) : null;
    const effectiveUserId = viewAs?.userId ?? parseInt(session.user.id);

    // Auto-détecter le PDV de l'utilisateur si non-admin (ou viewAs) et pdvId non fourni
    let effectivePdvId: number | null = pdvIdQ ? Number(pdvIdQ) : null;
    if (!effectivePdvId && (!isAdmin || viewAs)) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId: effectiveUserId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (aff) effectivePdvId = aff.pointDeVenteId;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { produit: { actif: true } };
    if (effectivePdvId) where.pointDeVenteId = effectivePdvId;
    if (enRupture) where.quantite = 0;
    if (search)    where.produit = { ...where.produit, OR: [
      { nom:       { contains: search, mode: "insensitive" } },
      { reference: { contains: search, mode: "insensitive" } },
    ]};

    const [stocks, total] = await Promise.all([
      prisma.stockSite.findMany({
        where,
        skip,      
        take: limit,
        orderBy: [{ pointDeVente: { nom: "asc" } }, { produit: { nom: "asc" } }],
        include: {
          produit:      { select: { id: true, nom: true, reference: true, description: true, categorie: true, unite: true, prixUnitaire: true, prixAchat: true, alerteStock: true } },
          pointDeVente: { select: { id: true, nom: true, code: true, type: true } },
        },
      }),
      prisma.stockSite.count({ where }),
    ]);

    // Stats sur le périmètre filtré (PDV de l'utilisateur ou global pour admin)
    const statsWhere = effectivePdvId
      ? { pointDeVenteId: effectivePdvId, produit: { actif: true } }
      : { produit: { actif: true } };
    const allStocks = await prisma.stockSite.findMany({
      where: statsWhere,
      select: { quantite: true, quantiteEndommagee: true, alerteStock: true, produit: { select: { prixUnitaire: true, prixAchat: true, alerteStock: true } } },
    });

    const SURSTOCK_MULTIPLE = 5;
    const PERTE_SEUIL_PCT   = 10;

    const enRuptureCount   = allStocks.filter(s => s.quantite === 0).length;
    const faibleCount      = allStocks.filter(s => {
      const seuil = s.alerteStock ?? s.produit.alerteStock;
      return s.quantite > 0 && s.quantite <= seuil;
    }).length;
    const surstockCount    = allStocks.filter(s => {
      const seuil = s.alerteStock ?? s.produit.alerteStock;
      return seuil > 0 && s.quantite > seuil * SURSTOCK_MULTIPLE;
    }).length;
    const perteEleveeCount = allStocks.filter(s => {
      const total = s.quantite + s.quantiteEndommagee;
      return total > 0 && (s.quantiteEndommagee / total) * 100 >= PERTE_SEUIL_PCT;
    }).length;
    const totalEndommage   = allStocks.reduce((acc, s) => acc + s.quantiteEndommagee, 0);
    const totalStockBrut   = allStocks.reduce((acc, s) => acc + s.quantite + s.quantiteEndommagee, 0);
    const pctEndommage     = totalStockBrut > 0 ? Math.round((totalEndommage / totalStockBrut) * 100 * 10) / 10 : 0;
    const valeurTotale     = allStocks.reduce((acc, s) => {
      const coutUnit = Number(s.produit.prixAchat ?? s.produit.prixUnitaire);
      return acc + s.quantite * coutUnit;
    }, 0);
    const totalProduits    = allStocks.length;

    // Liste des PDV pour filtre (admin uniquement — non-admin voit déjà leur PDV)
    const pdvs = await prisma.pointDeVente.findMany({
      where: { actif: true },
      select: { id: true, nom: true, code: true, type: true },
      orderBy: { nom: "asc" },
    });

    // Retourner les données aplaties pour compat avec les pages existantes
    // id = produit.id (important pour les appels API d'ajustement)
    const data = stocks.map(s => ({
      id:                 s.produit.id,
      nom:                s.produit.nom,
      description:        s.produit.description,
      prixUnitaire:       s.produit.prixUnitaire,
      prixAchat:          s.produit.prixAchat,
      valeurStock:        s.quantite * Number(s.produit.prixAchat ?? s.produit.prixUnitaire),
      stock:              s.quantite,   // alias compat
      quantite:           s.quantite,
      quantiteReservee:   s.quantiteReservee,
      quantiteEnTransit:  s.quantiteEnTransit,
      quantiteEndommagee: s.quantiteEndommagee,
      stockTheorique:     s.quantite + s.quantiteReservee + s.quantiteEnTransit - s.quantiteEndommagee,
      alerteStock:        s.alerteStock ?? s.produit.alerteStock,
      pointDeVente:       s.pointDeVente,
      stockSiteId:        s.id,
    }));

    return NextResponse.json({
      data,
      pdvs,
      userPdvId:   effectivePdvId,
      stats: { totalProduits, totalSites: totalProduits, enRupture: enRuptureCount, enRuptureCount, faibleCount, stockFaible: faibleCount, surstockCount, perteEleveeCount, totalEndommage, pctEndommage, valeurTotale },
      meta:  { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /logistique/stock:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
