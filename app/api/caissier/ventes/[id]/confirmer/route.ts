import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

function genRef(): string {
  const d   = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ENC-${ymd}-${rand}`;
}

/**
 * POST /api/caissier/ventes/[id]/confirmer
 * Confirme ou rejette une VenteDirecte PAID créée par un agent terrain.
 * Body: { action: "CONFIRMER" | "REJETER", notes? }
 *
 * CONFIRMER → statut CONFIRMEE + OperationCaisse encaissement
 * REJETER   → statut ANNULEE + remise en stock + notification agent
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const venteId = parseInt(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { action, notes } = body as { action: string; notes?: string };

    if (!["CONFIRMER", "REJETER"].includes(action)) {
      return NextResponse.json({ error: "action doit être CONFIRMER ou REJETER" }, { status: 400 });
    }

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);
    const caissierNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    // Récupérer la vente PAID scoped au PDV du caissier
    const vente = await prisma.venteDirecte.findFirst({
      where: {
        id:     venteId,
        statut: "PAID",
        ...(pdvId ? { pointDeVenteId: pdvId } : {}),
      },
      include: {
        lignes:  true,
        vendeur: { select: { id: true, nom: true, prenom: true } },
        client:  { select: { nom: true, prenom: true } },
      },
    });

    if (!vente) {
      return NextResponse.json(
        { error: "Vente PAID introuvable ou hors périmètre" },
        { status: 404 }
      );
    }

    const montantNum = Number(vente.montantTotal);

    // ── REJET ──────────────────────────────────────────────────────────────────
    if (action === "REJETER") {
      await prisma.$transaction(async (tx) => {
        await tx.venteDirecte.update({
          where: { id: venteId },
          data:  { statut: "ANNULEE", notes: notes ? `[Rejeté] ${notes}` : "[Rejeté par caissier]" },
        });

        // Remettre le stock (la vente PAID avait décrémenté le stock)
        if (vente.pointDeVenteId) {
          for (const ligne of vente.lignes) {
            if (!ligne.produitId) continue;
            await tx.stockSite.update({
              where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: vente.pointDeVenteId! } },
              data:  { quantite: { increment: ligne.quantite } },
            });
            await tx.mouvementStock.create({
              data: {
                produitId:      ligne.produitId,
                pointDeVenteId: vente.pointDeVenteId!,
                type:           "ENTREE",
                quantite:       ligne.quantite,
                motif:          `Annulation vente rejetée ${vente.reference}`,
                reference:      `${vente.reference}-RETOUR-P${ligne.produitId}`,
                operateurId:    userId,
                venteDirecteId: venteId,
              },
            });
          }
        }

        await auditLog(tx, userId, "VENTE_DIRECTE_REJETEE", "VenteDirecte", venteId);

        if (vente.vendeurId) {
          await tx.notification.create({
            data: {
              userId:    vente.vendeurId,
              titre:     "Vente rejetée",
              message:   `Votre vente ${vente.reference} (${montantNum.toLocaleString("fr-FR")} FCFA) a été rejetée par le caissier.${notes ? ` Motif : ${notes}` : ""}`,
              priorite:  "HAUTE",
              actionUrl: "/dashboard/user/agentsTerrain",
            },
          });
        }
      });

      return NextResponse.json({ success: true, message: "Vente rejetée et stock remis" });
    }

    // ── CONFIRMATION ───────────────────────────────────────────────────────────
    const sessionActive = await prisma.sessionCaisse.findFirst({
      where: {
        statut:    { in: ["OUVERTE", "SUSPENDUE"] },
        caissierId: userId,
      },
      orderBy: { createdAt: "desc" },
    });

    await prisma.$transaction(async (tx) => {
      await tx.venteDirecte.update({
        where: { id: venteId },
        data:  { statut: "CONFIRMEE" },
      });

      // Créer une OperationCaisse si session active
      if (sessionActive) {
        const vendeurNom = vente.vendeur
          ? `${vente.vendeur.prenom} ${vente.vendeur.nom}`
          : "agent";
        await tx.operationCaisse.create({
          data: {
            sessionId:    sessionActive.id,
            type:         "ENCAISSEMENT",
            mode:         "ESPECES",
            montant:      new Prisma.Decimal(montantNum),
            motif:        `Vente terrain confirmée — ${vente.reference} (${vendeurNom})`,
            reference:    genRef(),
            operateurNom: caissierNom,
            operateurId:  userId,
          },
        });
      }

      await auditLog(tx, userId, "VENTE_DIRECTE_CONFIRMEE_CAISSIER", "VenteDirecte", venteId);

      const clientNom = vente.client
        ? `${vente.client.prenom} ${vente.client.nom}`
        : vente.clientNom ?? "—";

      await notifyAdmins(tx, {
        titre:    `Vente terrain confirmée — ${vente.reference}`,
        message:  `${caissierNom} a confirmé la vente ${vente.reference} de ${montantNum.toLocaleString("fr-FR")} FCFA (client : ${clientNom}).`,
        priorite: "NORMAL",
        actionUrl: "/dashboard/admin/ventes",
      });

      if (vente.vendeurId) {
        await tx.notification.create({
          data: {
            userId:    vente.vendeurId,
            titre:     "Vente confirmée",
            message:   `Votre vente ${vente.reference} (${montantNum.toLocaleString("fr-FR")} FCFA) a été confirmée par le caissier.`,
            priorite:  "NORMAL",
            actionUrl: "/dashboard/user/agentsTerrain",
          },
        });
      }
    });

    return NextResponse.json({ success: true, data: { venteId } });
  } catch (error) {
    console.error("POST /api/caissier/ventes/[id]/confirmer", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
