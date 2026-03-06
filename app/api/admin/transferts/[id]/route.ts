import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { notifyAdmins, notify, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/transferts/[id]
 * Détail d'un transfert
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const transfertId = parseInt(id);

    const transfert = await prisma.transfertStock.findUnique({
      where: { id: transfertId },
      include: {
        origine:     { select: { id: true, nom: true, code: true, type: true } },
        destination: { select: { id: true, nom: true, code: true, type: true } },
        creePar:     { select: { id: true, nom: true, prenom: true } },
        validePar:   { select: { id: true, nom: true, prenom: true } },
        lignes: {
          include: { produit: { select: { id: true, nom: true, reference: true, unite: true, prixUnitaire: true } } },
        },
      },
    });

    if (!transfert) {
      return NextResponse.json({ error: "Transfert introuvable" }, { status: 404 });
    }

    return NextResponse.json({ data: transfert });
  } catch (error) {
    console.error("GET /api/admin/transferts/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/transferts/[id]
 * Admin peut :
 *  - Annuler (ANNULE) : restaure le stock source
 *  - Confirmer manuellement (RECU) : incrémente le stock destination
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const transfertId = parseInt(id);
    const adminId = parseInt(session.user.id);

    const body = await req.json();
    const { action } = body; // "ANNULE" | "RECU"

    if (!["ANNULE", "RECU"].includes(action)) {
      return NextResponse.json({ error: "Action invalide. Utilisez ANNULE ou RECU" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const transfert = await tx.transfertStock.findUnique({
        where: { id: transfertId },
        include: {
          lignes:      true,
          origine:     { select: { id: true, nom: true } },
          destination: { select: { id: true, nom: true } },
        },
      });

      if (!transfert) throw new Error("Transfert introuvable");
      if (!["EN_COURS", "EXPEDIE"].includes(transfert.statut)) {
        throw new Error(`Ce transfert est déjà ${transfert.statut.toLowerCase()} et ne peut plus être modifié`);
      }

      if (action === "ANNULE") {
        // Restore source stock for each line
        for (const ligne of transfert.lignes) {
          await tx.stockSite.upsert({
            where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: transfert.origineId } },
            update: { quantite: { increment: ligne.quantite } },
            create: { produitId: ligne.produitId, pointDeVenteId: transfert.origineId, quantite: ligne.quantite },
          });
          await tx.mouvementStock.create({
            data: {
              produitId:        ligne.produitId,
              pointDeVenteId:   transfert.origineId,
              type:             "ENTREE",
              typeEntree:       "AJUSTEMENT_POSITIF",
              quantite:         ligne.quantite,
              motif:            `Annulation transfert ${transfert.reference} — stock restauré sur ${transfert.origine.nom}`,
              reference:        `${transfert.reference}-RETOUR-${ligne.produitId}-${Date.now()}`,
              operateurId:      adminId,
              transfertStockId: transfert.id,
            },
          });
        }

        const updated = await tx.transfertStock.update({
          where: { id: transfertId },
          data: { statut: "ANNULE" },
        });

        // Notify destination staff that transfer was cancelled
        const affectations = await tx.gestionnaireAffectation.findMany({
          where: {
            pointDeVenteId: transfert.destinationId,
            actif: true,
            user: {
              gestionnaire: {
                role: { in: ["RESPONSABLE_POINT_DE_VENTE", "MAGAZINIER", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"] as never[] },
                actif: true,
              },
            },
          },
          select: { userId: true },
        });
        await notify(tx, affectations.map((a) => a.userId), {
          titre:    `Transfert annulé — ${transfert.reference}`,
          message:  `Le transfert de stock depuis ${transfert.origine.nom} vers ${transfert.destination.nom} (réf. ${transfert.reference}) a été annulé par l'administrateur.`,
          priorite: "HAUTE",
          actionUrl: `/dashboard/transferts`,
        });

        await notifyAdmins(tx, {
          titre:    `Transfert annulé — ${transfert.reference}`,
          message:  `Le transfert ${transfert.reference} a été annulé. Le stock a été restauré sur ${transfert.origine.nom}.`,
          priorite: "HAUTE",
          actionUrl: `/dashboard/admin/stock`,
        });

        await auditLog(tx, adminId, "TRANSFERT_STOCK_ANNULE", "TransfertStock", transfertId);
        return updated;
      }

      // action === "RECU" — admin confirme manuellement la réception
      for (const ligne of transfert.lignes) {
        await tx.stockSite.upsert({
          where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: transfert.destinationId } },
          update: { quantite: { increment: ligne.quantite } },
          create: { produitId: ligne.produitId, pointDeVenteId: transfert.destinationId, quantite: ligne.quantite },
        });
        await tx.mouvementStock.create({
          data: {
            produitId:        ligne.produitId,
            pointDeVenteId:   transfert.destinationId,
            type:             "ENTREE",
            typeEntree:       "TRANSFERT_ENTRANT",
            quantite:         ligne.quantite,
            motif:            `Réception transfert ${transfert.reference} depuis ${transfert.origine.nom}`,
            reference:        `${transfert.reference}-ENTREE-${ligne.produitId}-${Date.now()}`,
            operateurId:      adminId,
            transfertStockId: transfert.id,
          },
        });
      }

      const updated = await tx.transfertStock.update({
        where: { id: transfertId },
        data: { statut: "RECU", valideParId: adminId, dateReception: new Date() },
      });

      await notifyAdmins(tx, {
        titre:    `Transfert confirmé — ${transfert.reference}`,
        message:  `Le transfert ${transfert.reference} a été confirmé manuellement par l'admin. Stock mis à jour sur ${transfert.destination.nom}.`,
        priorite: "NORMAL",
        actionUrl: `/dashboard/admin/stock`,
      });

      await auditLog(tx, adminId, "TRANSFERT_STOCK_RECU_ADMIN", "TransfertStock", transfertId);
      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    console.error("PATCH /api/admin/transferts/[id] error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
