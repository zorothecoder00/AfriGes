import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { notifyRoles, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

async function getAdminSession() {
  const s = await getAuthSession();
  if (!s) return null;
  if (s.user.role !== "ADMIN" && s.user.role !== "SUPER_ADMIN") return null;
  return s;
}

/**
 * PATCH /api/admin/ventes/[id]
 * Annule une vente directe (CONFIRMEE ou BROUILLON).
 * Body: { motif?: string }
 * - Recrédite le stock si la vente était CONFIRMEE
 * - Crée un mouvement RETOUR_CLIENT par ligne produit
 * - Notifie le comptable
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const venteId = parseInt(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId   = parseInt(session.user.id);
    const adminNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const body  = await req.json();
    const motif = String(body.motif ?? "").trim();

    const vente = await prisma.venteDirecte.findUnique({
      where: { id: venteId },
      include: { lignes: true },
    });
    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
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
          notes: `[ANNULÉE ${horodatage} par ${adminNom}]${motif ? ` Motif: ${motif}` : ""}\n${vente.notes ?? ""}`.trim(),
        },
      });

      // Recréditer le stock uniquement si la vente était déjà CONFIRMEE
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
              motif:          `Retour suite annulation vente ${vente.reference}${motif ? ` — ${motif}` : ""}`,
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
        message:  `${adminNom} (Admin) a annulé la vente ${vente.reference}.${motif ? ` Motif : ${motif}` : ""}`,
        priorite: PrioriteNotification.HAUTE,
        actionUrl: `/dashboard/admin/ventes`,
      });

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    console.error("PATCH /api/admin/ventes/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
