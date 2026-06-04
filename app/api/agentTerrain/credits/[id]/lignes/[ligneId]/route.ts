import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { TypeMouvement, TypeSortieStock } from "@prisma/client";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string; ligneId: string }> };

/**
 * PATCH /api/agentTerrain/credits/[id]/lignes/[ligneId]
 *
 * L'agent terrain confirme la livraison d'une ligne de crédit au nom du client.
 * Seules les lignes EN_ATTENTE d'un crédit ACTIF/EN_RETARD sont acceptées.
 *
 * Conséquences :
 *  - LigneCreditClient → LIVRE
 *  - StockSite : quantite -= quantite, quantiteReservee -= quantite
 *  - MouvementStock SORTIE LIVRAISON_CLIENT créé
 */
export async function PATCH(_req: Request, { params }: Ctx) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, ligneId } = await params;
    const creditId = Number(id);
    const ligneIdN = Number(ligneId);
    if (isNaN(creditId) || isNaN(ligneIdN)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const agentId = parseInt(session.user.id);

    const updated = await prisma.$transaction(async (tx) => {
      const ligne = await tx.ligneCreditClient.findUnique({
        where: { id: ligneIdN },
        include: {
          credit: {
            select: {
              id: true,
              pointDeVenteId: true,
              reference: true,
              statut: true,
              client: { select: { agentTerrainId: true } },
            },
          },
        },
      });

      if (!ligne || ligne.creditId !== creditId) throw new Error("LIGNE_INTROUVABLE");
      if (ligne.credit.client.agentTerrainId !== agentId) throw new Error("ACCES_REFUSE");
      if (!["ACTIF", "EN_RETARD"].includes(ligne.credit.statut)) throw new Error("CREDIT_NON_ACTIF");
      if (ligne.statut === "LIVRE") throw new Error("LIGNE_DEJA_LIVREE");
      if (ligne.statut !== "EN_ATTENTE") throw new Error("LIGNE_NON_EN_ATTENTE");

      const result = await tx.ligneCreditClient.update({
        where: { id: ligneIdN },
        data: {
          statut:         "LIVRE",
          traiteParId:    agentId,
          dateTraitement: new Date(),
        },
      });

      await auditLog(tx, agentId, "LIGNE_CREDIT_LIVRE_AGENT", "LigneCreditClient", ligneIdN);

      // ── Mouvement de stock ────────────────────────────────────────────────
      const pdvId = ligne.credit.pointDeVenteId;
      if (ligne.produitId && pdvId) {
        await tx.stockSite.updateMany({
          where: { produitId: ligne.produitId, pointDeVenteId: pdvId },
          data: {
            quantite:         { decrement: ligne.quantite },
            quantiteReservee: { decrement: ligne.quantite },
          },
        });
        const dateStr = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
        await tx.mouvementStock.create({
          data: {
            produitId:      ligne.produitId,
            pointDeVenteId: pdvId,
            type:           TypeMouvement.SORTIE,
            typeSortie:     TypeSortieStock.LIVRAISON_CLIENT,
            quantite:       ligne.quantite,
            prixUnitaire:   ligne.prixUnitaire,
            motif:          `Livraison crédit — ${ligne.credit.reference} (confirmé par agent terrain)`,
            reference:      `MVT-LIV-${creditId}-L${ligneIdN}-${dateStr}`,
            operateurId:    agentId,
          },
        });
      }

      return result;
    });

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        LIGNE_INTROUVABLE:    ["Ligne introuvable", 404],
        ACCES_REFUSE:         ["Accès refusé — ce crédit n'appartient pas à vos clients", 403],
        CREDIT_NON_ACTIF:     ["Le crédit doit être actif pour confirmer une livraison", 422],
        LIGNE_DEJA_LIVREE:    ["Cette ligne est déjà livrée", 409],
        LIGNE_NON_EN_ATTENTE: ["Seules les lignes EN_ATTENTE peuvent être marquées livrées", 422],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ error: msg }, { status });
      }
    }
    console.error("PATCH /api/agentTerrain/credits/[id]/lignes/[ligneId]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
