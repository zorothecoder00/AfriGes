import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "../fournisseurs/route";
import { calculerBesoinMRP } from "@/lib/mrp";

const MOIS_HISTORIQUE = 3; // fenêtre glissante pour la moyenne mensuelle des ventes
const TYPES_SORTIE_CLIENT = ["VENTE_DIRECTE", "LIVRAISON_PACK", "LIVRAISON_CLIENT"] as const;

/**
 * GET /api/logistique/mrp
 * Planification des besoins (CDC §6) : Besoin = Prévision ventes + Stock sécurité
 * − Stock disponible − Commandes en cours, calculé par (produit × PDV) à partir
 * du stock déjà paramétré (StockSite), de l'historique réel des sorties clients
 * (MouvementStock), de la demande ferme non couverte — souscriptions déjà
 * confirmées (LigneSouscriptionProduit) ET lignes de crédits clients déjà
 * validés non encore livrées (LigneCreditClient) — et des commandes déjà
 * engagées (BonCommande + réceptions fournisseur en cours).
 *
 * Query: pointDeVenteId? (sinon agrégé tous PDV), horizonMois? (défaut 1),
 *        search?, seuilPositifSeulement? (défaut true — ne montre que besoinNet > 0)
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const pointDeVenteId = searchParams.get("pointDeVenteId") ? Number(searchParams.get("pointDeVenteId")) : null;
    const horizonMois = Math.max(1, Number(searchParams.get("horizonMois") || 1));
    const search = (searchParams.get("search") || "").trim();
    const seuilPositifSeulement = searchParams.get("seuilPositifSeulement") !== "false";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stockWhere: any = { disponible: true };
    if (pointDeVenteId) stockWhere.pointDeVenteId = pointDeVenteId;
    if (search) stockWhere.produit = { nom: { contains: search, mode: "insensitive" } };

    const stocks = await prisma.stockSite.findMany({
      where: stockWhere,
      select: {
        produitId: true, pointDeVenteId: true, quantite: true, quantiteEnTransit: true,
        stockMin: true, seuilCritique: true, alerteStock: true,
        produit: { select: { id: true, nom: true, codeProduit: true, alerteStock: true, prixAchat: true, fournisseurPrincipalId: true } },
        pointDeVente: { select: { id: true, nom: true, code: true } },
      },
    });
    if (stocks.length === 0) return NextResponse.json({ data: [], stats: { produitsAAnalyser: 0, produitsABesoin: 0, besoinTotalUnites: 0 } });

    const produitIds = [...new Set(stocks.map((s) => s.produitId))];
    const pdvIds = [...new Set(stocks.map((s) => s.pointDeVenteId))];
    const depuis = new Date();
    depuis.setMonth(depuis.getMonth() - MOIS_HISTORIQUE);

    const [ventesAgg, souscriptionsAgg, creditsAgg, lignesPO, lignesReceptionEnCours] = await Promise.all([
      prisma.mouvementStock.groupBy({
        by: ["produitId", "pointDeVenteId"],
        where: {
          type: "SORTIE", typeSortie: { in: [...TYPES_SORTIE_CLIENT] },
          produitId: { in: produitIds }, pointDeVenteId: { in: pdvIds },
          dateMouvement: { gte: depuis },
        },
        _sum: { quantite: true },
      }),
      prisma.ligneSouscriptionProduit.groupBy({
        by: ["produitId", "pointDeVenteId"],
        where: { statut: "CONFIRME", produitId: { in: produitIds }, pointDeVenteId: { in: pdvIds } },
        _sum: { quantite: true },
      }),
      // Lignes de crédits clients déjà validés (précommande ferme au même titre
      // qu'une souscription confirmée), pas encore livrées au client.
      prisma.ligneCreditClient.groupBy({
        by: ["produitId", "pointDeVenteId"],
        where: {
          statut: "EN_ATTENTE", // pas encore livré
          produitId: { in: produitIds }, pointDeVenteId: { in: pdvIds },
          credit: { statut: { notIn: ["EN_ATTENTE_VALIDATION", "ANNULE", "REJETE"] } },
        },
        _sum: { quantite: true },
      }),
      prisma.ligneBonCommande.findMany({
        where: {
          produitId: { in: produitIds },
          bonCommande: { statut: { notIn: ["COMPLETED", "CANCELLED"] }, pointDeVenteId: { in: pdvIds } },
        },
        select: { produitId: true, quantite: true, quantiteRecue: true, bonCommande: { select: { pointDeVenteId: true } } },
      }),
      prisma.ligneReceptionAppro.findMany({
        where: {
          produitId: { in: produitIds },
          reception: { type: "FOURNISSEUR", statut: { in: ["BROUILLON", "EN_COURS", "RECU"] }, pointDeVenteId: { in: pdvIds } },
        },
        select: { produitId: true, quantiteAttendue: true, reception: { select: { pointDeVenteId: true } } },
      }),
    ]);

    const cle = (produitId: number, pointDeVenteId: number) => `${produitId}:${pointDeVenteId}`;
    const ventesMap = new Map(ventesAgg.map((v) => [cle(v.produitId, v.pointDeVenteId!), Number(v._sum.quantite ?? 0)]));

    const demandeFermeMap = new Map<string, number>();
    for (const v of souscriptionsAgg) {
      const k = cle(v.produitId!, v.pointDeVenteId!);
      demandeFermeMap.set(k, (demandeFermeMap.get(k) ?? 0) + Number(v._sum.quantite ?? 0));
    }
    for (const v of creditsAgg) {
      const k = cle(v.produitId!, v.pointDeVenteId!);
      demandeFermeMap.set(k, (demandeFermeMap.get(k) ?? 0) + Number(v._sum.quantite ?? 0));
    }

    const commandesEnCoursMap = new Map<string, number>();
    for (const l of lignesPO) {
      const k = cle(l.produitId, l.bonCommande.pointDeVenteId);
      commandesEnCoursMap.set(k, (commandesEnCoursMap.get(k) ?? 0) + (l.quantite - l.quantiteRecue));
    }
    for (const l of lignesReceptionEnCours) {
      const k = cle(l.produitId, l.reception.pointDeVenteId);
      commandesEnCoursMap.set(k, (commandesEnCoursMap.get(k) ?? 0) + l.quantiteAttendue);
    }

    const lignes = stocks.map((s) => {
      const k = cle(s.produitId, s.pointDeVenteId);
      const moyenneMensuelleVentes = (ventesMap.get(k) ?? 0) / MOIS_HISTORIQUE;
      const resultat = calculerBesoinMRP({
        moyenneMensuelleVentes,
        horizonMois,
        demandeFermeNonCouverte: demandeFermeMap.get(k) ?? 0,
        stockSecurite: s.stockMin ?? s.seuilCritique ?? s.alerteStock ?? s.produit.alerteStock ?? 0,
        stockDisponible: s.quantite,
        stockEnTransit: s.quantiteEnTransit,
        commandesEnCours: commandesEnCoursMap.get(k) ?? 0,
      });
      return {
        produit: { id: s.produit.id, nom: s.produit.nom, codeProduit: s.produit.codeProduit, fournisseurPrincipalId: s.produit.fournisseurPrincipalId, prixAchat: s.produit.prixAchat },
        pointDeVente: s.pointDeVente,
        ...resultat,
      };
    });

    const filtrees = seuilPositifSeulement ? lignes.filter((l) => l.besoinNet > 0) : lignes;
    filtrees.sort((a, b) => b.besoinNet - a.besoinNet);

    // Vue agrégée tous PDV : somme du besoin net par produit (CDC §7 étape 3 —
    // "le système fusionne les demandes similaires").
    let agregatParProduit: { produitId: number; produitNom: string; codeProduit: string | null; besoinNetTotal: number; detailPdv: { pdvNom: string; besoinNet: number }[] }[] | null = null;
    if (!pointDeVenteId) {
      const parProduit = new Map<number, { produitNom: string; codeProduit: string | null; besoinNetTotal: number; detailPdv: { pdvNom: string; besoinNet: number }[] }>();
      for (const l of filtrees) {
        const existing = parProduit.get(l.produit.id) ?? { produitNom: l.produit.nom, codeProduit: l.produit.codeProduit, besoinNetTotal: 0, detailPdv: [] };
        existing.besoinNetTotal += l.besoinNet;
        existing.detailPdv.push({ pdvNom: l.pointDeVente.nom, besoinNet: l.besoinNet });
        parProduit.set(l.produit.id, existing);
      }
      agregatParProduit = Array.from(parProduit.entries())
        .map(([produitId, v]) => ({ produitId, ...v }))
        .sort((a, b) => b.besoinNetTotal - a.besoinNetTotal);
    }

    return NextResponse.json({
      data: filtrees,
      agregatParProduit,
      stats: {
        produitsAAnalyser: lignes.length,
        produitsABesoin: lignes.filter((l) => l.besoinNet > 0).length,
        besoinTotalUnites: lignes.reduce((s, l) => s + l.besoinNet, 0),
      },
      parametres: { horizonMois, moisHistorique: MOIS_HISTORIQUE },
    });
  } catch (error) {
    console.error("GET /logistique/mrp:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
