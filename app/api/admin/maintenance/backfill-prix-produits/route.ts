import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog } from "@/lib/notifications";

/**
 * POST /api/admin/maintenance/backfill-prix-produits
 *
 * Backfill unique : crée une entrée d'historique de prix INITIAL pour chaque
 * produit existant qui n'en a pas encore (à partir de ses prix actuels).
 *
 * SÛR EN PRODUCTION :
 *  - INSERT uniquement (ne modifie/supprime AUCUNE donnée existante) ;
 *  - IDEMPOTENT : ne cible que les produits SANS historique → relançable sans
 *    créer de doublon ;
 *  - dateEffet = date de création du produit (historiquement fidèle) ;
 *  - `{ dryRun: true }` dans le body → compte seulement, n'écrit rien.
 *
 * Réservé aux ADMIN / SUPER_ADMIN. La migration créant la table
 * HistoriquePrixProduit doit être appliquée au préalable.
 */
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;

    // Uniquement les produits qui n'ont encore AUCUNE entrée d'historique.
    const produits = await prisma.produit.findMany({
      where:  { historiquePrix: { none: {} } },
      select: { id: true, prixUnitaire: true, prixAchat: true, createdAt: true },
    });

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        aTraiter: produits.length,
        message: `${produits.length} produit(s) sans historique seraient initialisés.`,
      });
    }

    if (produits.length === 0) {
      return NextResponse.json({ crees: 0, message: "Aucun produit à initialiser (tout est déjà à jour)." });
    }

    const data = produits.map((p) => {
      const prixVente = p.prixUnitaire as Prisma.Decimal;
      const prixAchat = p.prixAchat as Prisma.Decimal | null;
      return {
        produitId: p.id,
        prixVente,
        prixAchat,
        marge:     prixAchat !== null ? prixVente.minus(prixAchat) : null,
        type:      "INITIAL" as const,
        source:    "INITIAL",
        motif:     "Backfill prix initial (produit existant)",
        creeParId: parseInt(session.user.id),
        dateEffet: p.createdAt, // date de création du produit
      };
    });

    const result = await prisma.$transaction(async (tx) => {
      const { count } = await tx.historiquePrixProduit.createMany({ data });
      await auditLog(tx, parseInt(session.user.id), "BACKFILL_PRIX_INITIAL", "HistoriquePrixProduit", undefined, { crees: count });
      return count;
    });

    return NextResponse.json({
      crees: result,
      message: `${result} entrée(s) d'historique INITIAL créée(s).`,
    });
  } catch (error) {
    console.error("POST /api/admin/maintenance/backfill-prix-produits", error);
    // Cas fréquent : migration non appliquée → table inexistante.
    return NextResponse.json(
      { error: "Échec du backfill. Vérifiez que la migration HistoriquePrixProduit est appliquée." },
      { status: 500 },
    );
  }
}
