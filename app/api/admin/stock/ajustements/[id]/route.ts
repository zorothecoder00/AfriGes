import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { notify, notifyAdmins, auditLog } from "@/lib/notifications";
import { randomUUID } from "crypto";

type Ctx = { params: Promise<{ id: string }> };

async function getAdminSession() {
  const s = await getAuthSession();
  if (!s) return null;
  if (s.user.role !== "ADMIN" && s.user.role !== "SUPER_ADMIN") return null;
  return s;
}

/**
 * PATCH /api/admin/stock/ajustements/[id]
 * Approuver ou rejeter une demande d'ajustement de stock.
 * Body: { action: "APPROUVE" | "REJETE", commentaire? }
 *
 * Si APPROUVE :
 *  - Stock mis à jour (StockSite.quantite = nouvelleQuantite)
 *  - MouvementStock AJUSTEMENT créé
 *  - Demandeur notifié
 *
 * Si REJETE :
 *  - Aucune modification stock
 *  - Demandeur notifié avec commentaire
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const demandeId = parseInt(id);
    const adminId   = parseInt(session.user.id);
    const adminNom  = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const body = await req.json();
    const { action, commentaire } = body;

    if (!["APPROUVE", "REJETE"].includes(action)) {
      return NextResponse.json({ error: "action invalide : APPROUVE ou REJETE" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const demande = await tx.demandeAjustementStock.findUnique({
        where: { id: demandeId },
        include: {
          produit:      { select: { id: true, nom: true } },
          pointDeVente: { select: { id: true, nom: true } },
        },
      });

      if (!demande) throw new Error("Demande introuvable");
      if (demande.statut !== "EN_ATTENTE") {
        throw new Error(`Cette demande a déjà été ${demande.statut === "APPROUVE" ? "approuvée" : "rejetée"}`);
      }

      // Mise à jour du statut de la demande
      const updated = await tx.demandeAjustementStock.update({
        where: { id: demandeId },
        data: {
          statut:               action,
          validateurId:         adminId,
          commentaireValidation: commentaire?.trim() || null,
        },
      });

      if (action === "APPROUVE") {
        // Vérification de sécurité : quantiteReservee
        const stockActuel = await tx.stockSite.findUnique({
          where: { produitId_pointDeVenteId: { produitId: demande.produitId, pointDeVenteId: demande.pointDeVenteId } },
        });
        const qteReservee = stockActuel?.quantiteReservee ?? 0;
        if (demande.nouvelleQuantite < qteReservee) {
          throw new Error(
            `Approbation impossible : la nouvelle quantité (${demande.nouvelleQuantite}) est inférieure aux quantités réservées (${qteReservee})`
          );
        }

        // Application du stock
        await tx.stockSite.upsert({
          where:  { produitId_pointDeVenteId: { produitId: demande.produitId, pointDeVenteId: demande.pointDeVenteId } },
          update: { quantite: demande.nouvelleQuantite },
          create: { produitId: demande.produitId, pointDeVenteId: demande.pointDeVenteId, quantite: demande.nouvelleQuantite },
        });

        const diff = demande.nouvelleQuantite - demande.ancienneQuantite;
        await tx.mouvementStock.create({
          data: {
            produitId:      demande.produitId,
            pointDeVenteId: demande.pointDeVenteId,
            type:           "AJUSTEMENT",
            typeEntree:     diff > 0 ? "AJUSTEMENT_POSITIF" : undefined,
            typeSortie:     diff < 0 ? "AJUSTEMENT_NEGATIF" : undefined,
            quantite:       Math.abs(diff),
            motif:          `Ajustement approuvé par ${adminNom} — ${demande.justification}`,
            reference:      `ADJ-${randomUUID().slice(0, 8).toUpperCase()}`,
            operateurId:    adminId,
          },
        });

        // Notifier le demandeur
        await notify(tx, [demande.demandeurId], {
          titre:    `Ajustement approuvé — ${demande.produit.nom}`,
          message:  `Votre demande d'ajustement de stock pour "${demande.produit.nom}" (${demande.pointDeVente.nom}) a été approuvée par ${adminNom}. Stock mis à jour : ${demande.ancienneQuantite} → ${demande.nouvelleQuantite}.`,
          priorite: "NORMAL",
          actionUrl: "/dashboard/user/magasiniers",
        });

        await auditLog(tx, adminId, "AJUSTEMENT_STOCK_APPROUVE", "DemandeAjustementStock", demandeId);
      } else {
        // REJETE — notifier le demandeur
        await notify(tx, [demande.demandeurId], {
          titre:    `Ajustement refusé — ${demande.produit.nom}`,
          message:  `Votre demande d'ajustement de stock pour "${demande.produit.nom}" (${demande.pointDeVente.nom}) a été refusée par ${adminNom}.${commentaire ? ` Raison : ${commentaire.trim()}` : ""}`,
          priorite: "HAUTE",
          actionUrl: "/dashboard/user/magasiniers",
        });

        await notifyAdmins(tx, {
          titre:    `Ajustement refusé — ${demande.produit.nom}`,
          message:  `${adminNom} a refusé la demande d'ajustement de stock pour "${demande.produit.nom}" (${demande.pointDeVente.nom}).${commentaire ? ` Raison : ${commentaire.trim()}` : ""}`,
          priorite: "NORMAL",
          actionUrl: "/dashboard/admin/stock/ajustements",
        });

        await auditLog(tx, adminId, "AJUSTEMENT_STOCK_REJETE", "DemandeAjustementStock", demandeId);
      }

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    console.error("PATCH /api/admin/stock/ajustements/[id]:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
