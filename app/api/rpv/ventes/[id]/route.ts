import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { notifyRoles, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/rpv/ventes/[id]
 * Actions : ANNULER (avec motif obligatoire)
 * Body: { action: "ANNULER", motif: string }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const venteId = parseInt(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId = parseInt(session.user.id);

    const pdv = await prisma.pointDeVente.findUnique({ where: { rpvId: userId } });
    if (!pdv) return NextResponse.json({ error: "Aucun PDV associé à ce RPV" }, { status: 400 });

    const body = await req.json();
    const { action, motif } = body;

    if (action !== "ANNULER") {
      return NextResponse.json({ error: "Action non reconnue. Actions valides: ANNULER" }, { status: 400 });
    }

    if (!motif || String(motif).trim().length < 5) {
      return NextResponse.json({ error: "Le motif d'annulation est obligatoire (min. 5 caractères)" }, { status: 400 });
    }

    // Vérifier que la vente appartient au PDV du RPV
    const vente = await prisma.venteDirecte.findUnique({
      where: { id: venteId },
      include: {
        lignes: true,
        vendeur: { select: { nom: true, prenom: true } },
      },
    });

    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
    if (vente.pointDeVenteId !== pdv.id) return NextResponse.json({ error: "Vente hors périmètre" }, { status: 403 });

    // Seules les ventes CONFIRMEE peuvent être annulées (pas BROUILLON, pas déjà ANNULEE)
    if (!["CONFIRMEE", "BROUILLON"].includes(vente.statut)) {
      return NextResponse.json(
        { error: `Impossible d'annuler une vente au statut "${vente.statut}"` },
        { status: 409 }
      );
    }

    const rpvNom = `${session.user.prenom} ${session.user.nom}`;
    const horodatage = new Date().toISOString();

    const result = await prisma.$transaction(async (tx) => {
      // Annuler la vente
      const updated = await tx.venteDirecte.update({
        where: { id: venteId },
        data: {
          statut: "ANNULEE",
          notes:  `[ANNULÉE ${horodatage} par ${rpvNom}] Motif: ${String(motif).trim()}\n${vente.notes ?? ""}`.trim(),
        },
      });

      // Re-créditer le stock pour les ventes CONFIRMEE uniquement
      if (vente.statut === "CONFIRMEE") {
        for (const ligne of vente.lignes) {
          await tx.stockSite.upsert({
            where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: pdv.id } },
            update: { quantite: { increment: ligne.quantite } },
            create: { produitId: ligne.produitId, pointDeVenteId: pdv.id, quantite: ligne.quantite },
          });
          await tx.mouvementStock.create({
            data: {
              produitId:      ligne.produitId,
              pointDeVenteId: pdv.id,
              type:           "ENTREE",
              typeEntree:     "RETOUR_CLIENT",
              quantite:       ligne.quantite,
              motif:          `Retour suite annulation vente ${vente.reference} — ${String(motif).trim()}`,
              reference:      `RET-${vente.reference}-P${ligne.produitId}`,
              operateurId:    userId,
            },
          });
        }
      }

      // Audit log horodaté avec motif
      await auditLog(
        tx,
        userId,
        `VENTE_ANNULEE | Motif: ${String(motif).trim()} | Horodatage: ${horodatage}`,
        "VenteDirecte",
        venteId
      );

      // Notifier le comptable
      await notifyRoles(tx, ["COMPTABLE"], {
        titre:    `Vente annulée — ${vente.reference}`,
        message:  `${rpvNom} (RPV) a annulé la vente ${vente.reference} sur "${pdv.nom}". Motif : ${String(motif).trim()}`,
        priorite: PrioriteNotification.HAUTE,
        actionUrl:`/dashboard/user/comptables`,
      });

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    console.error("PATCH /rpv/ventes/[id]:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
