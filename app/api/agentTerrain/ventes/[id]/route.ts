import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { auditLog, notifyRoles } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/agentTerrain/ventes/[id]
 * Actions disponibles pour l'agent terrain :
 *  - "ANNULER"  : BROUILLON → ANNULEE
 *  - "LIVRER"   : SORTIE_VALIDEE → LIVREE (l'agent confirme la livraison au client)
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const venteId = Number(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { action } = body;

    if (!["ANNULER", "LIVRER"].includes(action)) {
      return NextResponse.json({ error: "action invalide (ANNULER | LIVRER)" }, { status: 400 });
    }

    const vente = await prisma.venteDirecte.findUnique({
      where: { id: venteId },
      include: { client: { select: { nom: true, prenom: true } } },
    });
    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
    if (vente.vendeurId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Vous ne pouvez agir que sur vos propres ventes" }, { status: 403 });
    }

    const agentNom = `${session.user.prenom} ${session.user.nom}`;

    // ── ANNULER ──────────────────────────────────────────────────────────────
    if (action === "ANNULER") {
      if (vente.statut !== "BROUILLON") {
        return NextResponse.json({ error: `Impossible d'annuler : statut actuel "${vente.statut}"` }, { status: 400 });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.venteDirecte.update({
          where: { id: venteId },
          data:  { statut: "ANNULEE" },
        });
        await auditLog(tx, parseInt(session.user.id), "VENTE_TERRAIN_ANNULEE", "VenteDirecte", venteId);
        return result;
      });
      return NextResponse.json({ data: updated });
    }

    // ── LIVRER ───────────────────────────────────────────────────────────────
    // L'agent terrain confirme que le client a physiquement reçu les produits.
    if (vente.statut !== "SORTIE_VALIDEE") {
      return NextResponse.json(
        { error: `Impossible de confirmer la livraison : statut actuel "${vente.statut}" (attendu : SORTIE_VALIDEE)` },
        { status: 400 }
      );
    }

    const clientNom = vente.client
      ? `${vente.client.prenom} ${vente.client.nom}`
      : vente.clientNom ?? "Client inconnu";

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.venteDirecte.update({
        where: { id: venteId },
        data:  { statut: "LIVREE" },
        include: { lignes: { include: { produit: { select: { id: true, nom: true } } } } },
      });

      await auditLog(tx, parseInt(session.user.id), "VENTE_TERRAIN_LIVREE", "VenteDirecte", venteId);

      // Notifier le RPV
      await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE"], {
        titre:    `Livraison confirmée — ${vente.reference}`,
        message:  `L'agent ${agentNom} a confirmé la livraison de la vente ${vente.reference} au client "${clientNom}".`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/user/responsablesPointDeVente`,
      });

      // Notifier le comptable
      await notifyRoles(tx, ["COMPTABLE"], {
        titre:    `Vente terrain livrée — ${vente.reference}`,
        message:  `La vente terrain ${vente.reference} (${Number(vente.montantTotal).toLocaleString("fr-FR")} FCFA) a été livrée par ${agentNom} au client "${clientNom}".`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/user/comptables`,
      });

      return result;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /agentTerrain/ventes/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
