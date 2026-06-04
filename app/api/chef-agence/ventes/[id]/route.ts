import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getChefAgenceSession, getChefAgencePdvIds } from "@/lib/authChefAgence";
import { notifyRoles, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/chef-agence/ventes/[id]
 * Annule une vente directe dans la zone du chef d'agence.
 * Body: { motif?: string }
 * - Vérifie que la vente appartient à un PDV de la zone
 * - Recrédite le stock si la vente était CONFIRMEE
 * - Notifie le comptable + les admins
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getChefAgenceSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const venteId = parseInt(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId = parseInt(session.user.id);
    const nomOp  = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();
    const pdvIds = await getChefAgencePdvIds(session);

    const body  = await req.json();
    const motif = String(body.motif ?? "").trim();

    const vente = await prisma.venteDirecte.findUnique({
      where: { id: venteId },
      include: { lignes: true },
    });
    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });

    // Vérifier que la vente est dans la zone (admin = null → pas de restriction)
    if (pdvIds !== null && !pdvIds.includes(vente.pointDeVenteId)) {
      return NextResponse.json({ error: "Vente hors périmètre" }, { status: 403 });
    }

    if (!["CONFIRMEE", "BROUILLON"].includes(vente.statut)) {
      return NextResponse.json(
        { error: `Impossible d'annuler une vente au statut "${vente.statut}"` },
        { status: 409 }
      );
    }

    const horodatage = new Date().toISOString();

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.venteDirecte.update({
        where: { id: venteId },
        data: {
          statut: "ANNULEE",
          notes: `[ANNULÉE ${horodatage} par ${nomOp}]${motif ? ` Motif: ${motif}` : ""}\n${vente.notes ?? ""}`.trim(),
        },
      });

      if (vente.statut === "CONFIRMEE") {
        for (const ligne of vente.lignes) {
          if (!ligne.produitId) continue;
          await tx.stockSite.upsert({
            where: {
              produitId_pointDeVenteId: {
                produitId:      ligne.produitId,
                pointDeVenteId: vente.pointDeVenteId,
              },
            },
            update: { quantite: { increment: ligne.quantite } },
            create: {
              produitId:      ligne.produitId,
              pointDeVenteId: vente.pointDeVenteId,
              quantite:       ligne.quantite,
            },
          });
          await tx.mouvementStock.create({
            data: {
              produitId:      ligne.produitId,
              pointDeVenteId: vente.pointDeVenteId,
              type:           "ENTREE",
              typeEntree:     "RETOUR_CLIENT",
              quantite:       ligne.quantite,
              motif:          `Retour annulation vente ${vente.reference}${motif ? ` — ${motif}` : ""}`,
              reference:      `RET-${vente.reference}-P${ligne.produitId}`,
              operateurId:    userId,
            },
          });
        }
      }

      await auditLog(
        tx,
        userId,
        `VENTE_ANNULEE | Motif: ${motif || "non précisé"} | ${horodatage}`,
        "VenteDirecte",
        venteId
      );

      await notifyRoles(tx, ["COMPTABLE"], {
        titre:    `Vente annulée — ${vente.reference}`,
        message:  `${nomOp} (Chef Agence) a annulé la vente ${vente.reference}.${motif ? ` Motif : ${motif}` : ""}`,
        priorite: PrioriteNotification.HAUTE,
        actionUrl: `/dashboard/admin/ventes`,
      });

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    console.error("PATCH /api/chef-agence/ventes/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
