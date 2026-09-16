import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { genererReferenceUnique, snapshotLignesDepot } from "@/lib/depotVente";
import { getSession } from "../../fournisseurs/route";

/**
 * Demande de règlement fournisseur / État des sommes dues (CDC digitalisation
 * §5.5). Générée en BROUILLON à partir des ventes constatées depuis le
 * dernier règlement (voir calcul de `quantiteDejaReglee` ci-dessous — sans
 * ça, deux règlements successifs sur la même convention recompteraient les
 * mêmes unités vendues, `snapshotLignesDepot` étant un instantané cumulé, pas
 * un delta). Soumise ensuite via le circuit Fiche de Décaissement existant.
 */

export const INCLUDE = {
  convention: { select: { id: true, reference: true, fournisseur: { select: { id: true, nom: true } } } },
  demandePar: { select: { id: true, nom: true, prenom: true } },
  lignes: { include: { ligneDepot: { include: { produit: { select: { id: true, nom: true } }, depot: { select: { id: true, reference: true } } } } } },
  decaissements: { select: { id: true, reference: true, statut: true } },
};

/**
 * GET /api/logistique/depot-vente/reglements
 * Query: statut?, conventionId?
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const conventionId = searchParams.get("conventionId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (conventionId) where.conventionId = Number(conventionId);

    const reglements = await prisma.reglementDepotVente.findMany({ where, orderBy: { createdAt: "desc" }, include: INCLUDE });
    return NextResponse.json({ data: reglements });
  } catch (error) {
    console.error("GET /logistique/depot-vente/reglements:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/logistique/depot-vente/reglements
 * Body: { conventionId, periodeDebut, periodeFin }
 * Calcule les ventes non encore réglées depuis le dernier règlement.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const conventionId = Number(body.conventionId);
    if (!conventionId) return NextResponse.json({ error: "Convention obligatoire" }, { status: 400 });

    const convention = await prisma.conventionDepotVente.findUnique({
      where: { id: conventionId },
      select: { id: true, commissionPourcent: true },
    });
    if (!convention) return NextResponse.json({ error: "Convention introuvable" }, { status: 404 });

    const depots = await prisma.depotMarchandise.findMany({
      where: { conventionId, statut: { in: ["EN_STOCK", "CLOTURE"] } },
      select: { lignes: { select: { id: true, produitId: true, quantiteDeposee: true, prixVenteConvenu: true, quantiteReprise: true, lotProduitId: true } } },
    });
    const toutesLignes = depots.flatMap((d) => d.lignes);
    if (!toutesLignes.length) return NextResponse.json({ error: "Aucun dépôt en stock pour cette convention" }, { status: 422 });

    const snapshots = await snapshotLignesDepot(prisma, toutesLignes);

    // Quantité déjà couverte par un règlement précédent (tous statuts confondus,
    // BROUILLON inclus — représente déjà une réclamation en cours).
    const dejaRegle = await prisma.ligneReglementDepotVente.groupBy({
      by: ["ligneDepotId"],
      where: { ligneDepotId: { in: toutesLignes.map((l) => l.id) } },
      _sum: { quantiteVendue: true },
    });
    const dejaRegleParLigne = new Map(dejaRegle.map((d) => [d.ligneDepotId, d._sum.quantiteVendue ?? 0]));

    const commissionPourcent = Number(convention.commissionPourcent);
    const lignesARegler = snapshots
      .map((s) => {
        const quantiteNouvelle = Math.max(0, s.quantiteVendue - (dejaRegleParLigne.get(s.ligneDepotId) ?? 0));
        const montantBrut = quantiteNouvelle * s.prixVenteConvenu;
        const montantCommission = Math.round(montantBrut * commissionPourcent / 100 * 100) / 100;
        return { ligneDepotId: s.ligneDepotId, quantiteVendue: quantiteNouvelle, montantBrut, montantCommission, montantNet: montantBrut - montantCommission };
      })
      .filter((l) => l.quantiteVendue > 0);

    if (!lignesARegler.length) {
      return NextResponse.json({ error: "Aucune vente non réglée pour cette convention" }, { status: 422 });
    }

    const montantVentesBrut = lignesARegler.reduce((s, l) => s + l.montantBrut, 0);
    const montantCommission = lignesARegler.reduce((s, l) => s + l.montantCommission, 0);
    const montantDu = montantVentesBrut - montantCommission;

    const userId = parseInt(session.user.id);
    const reglement = await genererReferenceUnique(
      "RDV",
      () => prisma.reglementDepotVente.count(),
      (reference) => prisma.$transaction(async (tx) => {
        const r = await tx.reglementDepotVente.create({
          data: {
            reference, conventionId,
            periodeDebut: body.periodeDebut ? new Date(body.periodeDebut) : new Date(0),
            periodeFin: body.periodeFin ? new Date(body.periodeFin) : new Date(),
            montantVentesBrut, montantCommission, montantDu,
            demandeParId: userId,
            lignes: { create: lignesARegler },
          },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "RDV_CREE", "ReglementDepotVente", r.id, { montantDu }, getRequestMeta(req));
        return r;
      }),
    );
    return NextResponse.json({ data: reglement }, { status: 201 });
  } catch (error) {
    console.error("POST /logistique/depot-vente/reglements:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
