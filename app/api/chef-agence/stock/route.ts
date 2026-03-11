import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChefAgenceSession, getChefAgencePdvIds } from "@/lib/authChefAgence";

/**
 * GET /api/chef-agence/stock?pdvId=X
 *
 * Stocks de toute la zone (ou d'un PDV précis) :
 *   - Valeur, ruptures, faibles par PDV
 *   - Détail produit par produit
 *   - Transferts inter-PDV actifs dans la zone
 *   - Inventaires récents
 */
export async function GET(req: Request) {
  try {
    const session = await getChefAgenceSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const pdvIds = await getChefAgencePdvIds(session);

    const { searchParams } = new URL(req.url);
    const pdvIdParam  = searchParams.get("pdvId") ? Number(searchParams.get("pdvId")) : null;

    // Restreindre si un PDV précis est demandé (et qu'il appartient à la zone)
    const effectivePdvIds = pdvIdParam
      ? (pdvIds === null || pdvIds.includes(pdvIdParam) ? [pdvIdParam] : [])
      : pdvIds;

    const stockFilter   = effectivePdvIds ? { pointDeVenteId: { in: effectivePdvIds } } : {};
    const transfertWhere = effectivePdvIds
      ? { OR: [{ origineId: { in: effectivePdvIds } }, { destinationId: { in: effectivePdvIds } }] }
      : {};

    const [pdvs, stockSites, transferts, inventaires] = await Promise.all([
      prisma.pointDeVente.findMany({
        where: effectivePdvIds ? { id: { in: effectivePdvIds }, actif: true } : { actif: true },
        select: { id: true, nom: true, code: true, type: true },
        orderBy: { nom: "asc" },
      }),

      prisma.stockSite.findMany({
        where: stockFilter,
        select: {
          pointDeVenteId: true,
          quantite:       true,
          alerteStock:    true,
          produit: {
            select: {
              id:           true,
              nom:          true,
              reference:    true,
              categorie:    true,
              unite:        true,
              prixUnitaire: true,
              alerteStock:  true,
            },
          },
        },
        orderBy: { produit: { nom: "asc" } },
      }),

      prisma.transfertStock.findMany({
        where: {
          statut: { in: ["EN_COURS", "EXPEDIE"] },
          ...transfertWhere,
        },
        select: {
          id: true, reference: true, statut: true,
          createdAt: true, dateExpedition: true,
          origine:     { select: { id: true, nom: true } },
          destination: { select: { id: true, nom: true } },
          lignes: { select: { quantite: true, produit: { select: { nom: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),

      prisma.inventaireSite.findMany({
        where: {
          ...(effectivePdvIds ? { pointDeVenteId: { in: effectivePdvIds } } : {}),
        },
        select: {
          id: true, reference: true, statut: true,
          dateInventaire: true,
          pointDeVente: { select: { id: true, nom: true } },
          realisePar:   { select: { nom: true, prenom: true } },
          lignes: {
            select: {
              quantiteSysteme:   true,
              quantiteConstatee: true,
              ecart:             true,
              produit: { select: { nom: true } },
            },
          },
        },
        orderBy: { dateInventaire: "desc" },
        take: 10,
      }),
    ]);

    // ── Organiser les stocks par PDV ───────────────────────────────────────────
    const parPdv: Record<number, {
      pdvId: number; pdvNom: string; pdvCode: string;
      valeur: number; ruptures: number; faibles: number;
      produits: Array<{
        id: number; nom: string; reference: string | null; categorie: string | null;
        unite: string | null; prixUnitaire: number;
        quantite: number; seuilAlerte: number; statut: "RUPTURE" | "ALERTE" | "OK";
        valeur: number;
      }>;
    }> = {};

    for (const p of pdvs) {
      parPdv[p.id] = { pdvId: p.id, pdvNom: p.nom, pdvCode: p.code, valeur: 0, ruptures: 0, faibles: 0, produits: [] };
    }

    for (const s of stockSites) {
      const pdv = parPdv[s.pointDeVenteId];
      if (!pdv) continue;
      const seuil  = s.alerteStock ?? s.produit.alerteStock;
      const valeur = s.quantite * Number(s.produit.prixUnitaire);
      const statut = s.quantite === 0
        ? "RUPTURE" as const
        : seuil > 0 && s.quantite <= seuil
          ? "ALERTE" as const
          : "OK" as const;
      pdv.valeur += valeur;
      if (statut === "RUPTURE") pdv.ruptures++;
      if (statut === "ALERTE")  pdv.faibles++;
      pdv.produits.push({
        id: s.produit.id, nom: s.produit.nom, reference: s.produit.reference,
        categorie: s.produit.categorie, unite: s.produit.unite,
        prixUnitaire: Number(s.produit.prixUnitaire),
        quantite: s.quantite, seuilAlerte: seuil, statut, valeur,
      });
    }

    const totalValeur   = Object.values(parPdv).reduce((s, p) => s + p.valeur, 0);
    const totalRuptures = Object.values(parPdv).reduce((s, p) => s + p.ruptures, 0);
    const totalFaibles  = Object.values(parPdv).reduce((s, p) => s + p.faibles, 0);

    return NextResponse.json({
      success: true,
      data: {
        parPdv: Object.values(parPdv),
        transfertsActifs: transferts.map((t) => ({
          id:            t.id,
          reference:     t.reference,
          statut:        t.statut,
          origineNom:    t.origine.nom,
          destinationNom: t.destination.nom,
          dateExpedition: t.dateExpedition?.toISOString() ?? null,
          createdAt:     t.createdAt.toISOString(),
          lignesResume:  t.lignes.map((l) => `${l.produit.nom} ×${l.quantite}`).join(", "),
          totalQuantite: t.lignes.reduce((s, l) => s + l.quantite, 0),
        })),
        inventairesRecents: inventaires.map((i) => ({
          id:          i.id,
          reference:   i.reference,
          statut:      i.statut,
          date:        i.dateInventaire.toISOString(),
          pdvNom:      i.pointDeVente?.nom ?? "—",
          realisePar:  `${i.realisePar.prenom} ${i.realisePar.nom}`,
          nbLignes:    i.lignes.length,
          totalEcart:  i.lignes.reduce((s, l) => s + l.ecart, 0),
          alertes:     i.lignes.filter((l) => l.ecart !== 0).map((l) => ({
            produit: l.produit.nom,
            systeme: l.quantiteSysteme,
            constate: l.quantiteConstatee,
            ecart:   l.ecart,
          })),
        })),
        stats: {
          totalValeur, totalRuptures, totalFaibles,
          nbPdvs: Object.keys(parPdv).length,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/chef-agence/stock error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
