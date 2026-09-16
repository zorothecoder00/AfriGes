import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { genererReferenceUnique } from "@/lib/depotVente";
import { getSession } from "../../fournisseurs/route";

/**
 * Fiche de dépôt de marchandises (CDC digitalisation §5.5) — saisie du dépôt.
 * Reste en BROUILLON tant que l'entrée physique n'a pas été constatée (action
 * CONSTATER_ENTREE sur /depots/[id], "Bon d'entrée en dépôt").
 */

export const INCLUDE = {
  convention: { select: { id: true, reference: true, statut: true, commissionPourcent: true, fournisseur: { select: { id: true, nom: true } } } },
  pointDeVente: { select: { id: true, nom: true, code: true } },
  creePar: { select: { id: true, nom: true, prenom: true } },
  entreePar: { select: { id: true, nom: true, prenom: true } },
  lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true } } } },
};

/**
 * GET /api/logistique/depot-vente/depots
 * Query: statut?, conventionId?, pointDeVenteId?
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const conventionId = searchParams.get("conventionId");
    const pointDeVenteId = searchParams.get("pointDeVenteId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (conventionId) where.conventionId = Number(conventionId);
    if (pointDeVenteId) where.pointDeVenteId = Number(pointDeVenteId);

    const [depots, pdvs] = await Promise.all([
      prisma.depotMarchandise.findMany({ where, orderBy: { createdAt: "desc" }, include: INCLUDE }),
      prisma.pointDeVente.findMany({ where: { actif: true }, select: { id: true, nom: true, code: true }, orderBy: { nom: "asc" } }),
    ]);
    return NextResponse.json({ data: depots, pdvs });
  } catch (error) {
    console.error("GET /logistique/depot-vente/depots:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

interface LigneInput { produitId: number; quantite: number; prixVenteConvenu: number; dlc?: string }

/**
 * POST /api/logistique/depot-vente/depots
 * Body: { conventionId, pointDeVenteId, lignes: [{produitId, quantite, prixVenteConvenu, dlc?}] }
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const conventionId = Number(body.conventionId);
    const pointDeVenteId = Number(body.pointDeVenteId);
    if (!conventionId || !pointDeVenteId) {
      return NextResponse.json({ error: "Convention et point de vente obligatoires" }, { status: 400 });
    }

    const convention = await prisma.conventionDepotVente.findUnique({ where: { id: conventionId }, select: { id: true, statut: true } });
    if (!convention) return NextResponse.json({ error: "Convention introuvable" }, { status: 404 });
    if (convention.statut !== "ACTIVE") return NextResponse.json({ error: "Convention non active" }, { status: 422 });

    const lignesInput = (body.lignes ?? []) as LigneInput[];
    if (!lignesInput.length) return NextResponse.json({ error: "Au moins une ligne est requise" }, { status: 400 });
    for (const l of lignesInput) {
      if (!l.produitId || !l.quantite || l.quantite <= 0 || l.prixVenteConvenu == null || l.prixVenteConvenu <= 0) {
        return NextResponse.json({ error: "Chaque ligne doit avoir produitId, quantite (>0) et prixVenteConvenu (>0)" }, { status: 400 });
      }
    }

    const userId = parseInt(session.user.id);

    const depot = await genererReferenceUnique(
      "DEP",
      () => prisma.depotMarchandise.count(),
      (reference) => prisma.$transaction(async (tx) => {
        const d = await tx.depotMarchandise.create({
          data: {
            reference,
            conventionId,
            pointDeVenteId,
            creeParId: userId,
            lignes: {
              create: lignesInput.map((l) => ({
                produitId: Number(l.produitId),
                quantiteDeposee: Number(l.quantite),
                prixVenteConvenu: Number(l.prixVenteConvenu),
                dlc: l.dlc ? new Date(l.dlc) : null,
              })),
            },
          },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "DEP_CREE", "DepotMarchandise", d.id, undefined, getRequestMeta(req));
        return d;
      }),
    );
    return NextResponse.json({ data: depot }, { status: 201 });
  } catch (error) {
    console.error("POST /logistique/depot-vente/depots:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
