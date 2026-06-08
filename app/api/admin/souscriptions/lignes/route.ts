import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { getLogistiqueSession } from "@/lib/authLogistique";

/**
 * GET /api/admin/souscriptions/lignes
 * Tableau de traitement des demandes produits de souscription.
 *
 * Pour chaque ligne :
 *  - produit != null  → produit.nom est le nom canonique du catalogue
 *  - produit == null  → produitNomSaisi est la saisie libre de l'agent,
 *                       estNouveauProduit = true → l'admin doit créer le produit
 *
 * Query:
 *   statut   — filtre par StatutLigneSouscription (défaut: EN_ATTENTE ; "TOUS" = pas de filtre)
 *   pdvId    — filtre par point de vente
 *   search   — cherche dans produitNomSaisi ou nom du client
 *   page     — défaut 1
 *   limit    — max 50, défaut 20
 */
export async function GET(req: NextRequest) {
  try {
    const session = (await getAdminSession()) ?? (await getLogistiqueSession());
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut") || "EN_ATTENTE";
    const search = searchParams.get("search")?.trim() ?? "";
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip   = (page - 1) * limit;

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const userId  = parseInt(session.user.id);

    // Pour non-admin : force le filtre sur leur PDV
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
    const where: any = {};
    if (statut && statut !== "TOUS") where.statut = statut;
    if (pdvId) where.pointDeVenteId = pdvId;
    if (search) {
      where.OR = [
        { produitNomSaisi: { contains: search, mode: "insensitive" } },
        { souscription: { client: { nom:    { contains: search, mode: "insensitive" } } } },
        { souscription: { client: { prenom: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const [lignes, total, countEnAttente, countNouveauxProduits] = await Promise.all([
      prisma.ligneSouscriptionProduit.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ statut: "asc" }, { createdAt: "asc" }],
        include: {
          souscription: {
            select: {
              id: true,
              pack:   { select: { id: true, nom: true, type: true } },
              client: {
                select: {
                  id: true, nom: true, prenom: true, telephone: true, segment: true,
                  tags: { select: { tag: { select: { id: true, nom: true, couleur: true } } } },
                },
              },
            },
          },
          // Renseigné si le produit existe dans le catalogue — nom canonique
          produit:          { select: { id: true, nom: true, unite: true, prixUnitaire: true, reference: true } },
          produitSubstitut: { select: { id: true, nom: true, unite: true, prixUnitaire: true } },
          traitePar:        { select: { id: true, nom: true, prenom: true } },
          pointDeVente:     { select: { id: true, nom: true, code: true } },
        },
      }),
      prisma.ligneSouscriptionProduit.count({ where }),
      prisma.ligneSouscriptionProduit.count({ where: { statut: "EN_ATTENTE", ...(pdvId ? { pointDeVenteId: pdvId } : {}) } }),
      // Demandes de produits inconnus encore en attente (à créer dans le catalogue)
      prisma.ligneSouscriptionProduit.count({ where: { statut: "EN_ATTENTE", estNouveauProduit: true, ...(pdvId ? { pointDeVenteId: pdvId } : {}) } }),
    ]);

    return NextResponse.json({
      lignes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: { countEnAttente, countNouveauxProduits },
    });
  } catch (error) {
    console.error("GET /api/admin/souscriptions/lignes", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
