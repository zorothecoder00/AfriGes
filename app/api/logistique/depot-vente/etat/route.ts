import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { snapshotLignesDepot } from "@/lib/depotVente";
import { getSession } from "../../fournisseurs/route";

/**
 * GET /api/logistique/depot-vente/etat?conventionId=
 * Synthèse dépôt-vente (CDC §5.5) : État du stock en dépôt par fournisseur,
 * État des ventes des produits déposés, État des invendus, État des sommes
 * dues au fournisseur, Rapport périodique — un seul endpoint agrégé plutôt
 * que 5 routes séparées pour la même donnée sous-jacente (snapshotLignesDepot).
 * Query facultative : conventionId (sinon toutes les conventions).
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const conventionId = searchParams.get("conventionId") ? Number(searchParams.get("conventionId")) : null;

    const conventions = await prisma.conventionDepotVente.findMany({
      where: conventionId ? { id: conventionId } : {},
      select: {
        id: true, reference: true, commissionPourcent: true,
        fournisseur: { select: { id: true, nom: true } },
        depots: {
          where: { statut: { in: ["EN_STOCK", "CLOTURE"] } },
          select: {
            id: true, reference: true, statut: true, dateDepot: true,
            pointDeVente: { select: { id: true, nom: true } },
            lignes: {
              select: {
                id: true, produitId: true, quantiteDeposee: true, prixVenteConvenu: true, quantiteReprise: true, lotProduitId: true,
                produit: { select: { nom: true, codeProduit: true } },
              },
            },
          },
        },
      },
    });

    const data = await Promise.all(conventions.map(async (c) => {
        const toutesLignes = c.depots.flatMap((d) => d.lignes.map((l) => ({ ...l, depotId: d.id, depotReference: d.reference, produitNom: l.produit.nom })));
        const snapshots = await snapshotLignesDepot(prisma, toutesLignes);
        const snapshotParLigne = new Map(snapshots.map((s) => [s.ligneDepotId, s]));

        const lignesDetail = toutesLignes.map((l) => {
          const s = snapshotParLigne.get(l.id);
          const quantiteVendue = s?.quantiteVendue ?? 0;
          const quantiteRestante = s?.quantiteRestante ?? 0;
          const montantBrut = s?.montantBrut ?? 0;
          const montantCommission = Math.round(montantBrut * Number(c.commissionPourcent) / 100 * 100) / 100;
          return {
            depotId: l.depotId, depotReference: l.depotReference,
            produitId: l.produitId, produitNom: l.produitNom, codeProduit: l.produit.codeProduit,
            quantiteDeposee: l.quantiteDeposee, quantiteVendue, quantiteRestante, quantiteReprise: l.quantiteReprise,
            prixVenteConvenu: Number(l.prixVenteConvenu), montantBrut, montantCommission, montantNet: montantBrut - montantCommission,
          };
        });

        const stockEnDepot = lignesDetail.filter((l) => l.quantiteRestante > 0);
        const ventes = lignesDetail.filter((l) => l.quantiteVendue > 0);
        const invendus = stockEnDepot; // alias explicite CDC "État des invendus"
        const montantVentesBrut = lignesDetail.reduce((s, l) => s + l.montantBrut, 0);
        const montantCommission = lignesDetail.reduce((s, l) => s + l.montantCommission, 0);
        const montantDu = montantVentesBrut - montantCommission;

        return {
          conventionId: c.id, conventionReference: c.reference,
          fournisseur: c.fournisseur, commissionPourcent: Number(c.commissionPourcent),
          stockEnDepot, ventes, invendus,
          synthese: { montantVentesBrut, montantCommission, montantDu },
        };
      }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /logistique/depot-vente/etat:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
