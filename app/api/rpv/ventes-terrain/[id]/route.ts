import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { auditLog, notifyRoles } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/rpv/ventes-terrain/[id]
 * Le RPV confirme (BROUILLON → CONFIRMEE) ou annule (BROUILLON → ANNULEE) une demande de vente terrain.
 * Body: { action: "CONFIRMER" | "ANNULER", motifRefus? }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const venteId = Number(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { action, motifRefus } = body;

    if (!["CONFIRMER", "ANNULER"].includes(action)) {
      return NextResponse.json({ error: "action invalide (CONFIRMER | ANNULER)" }, { status: 400 });
    }

    const vente = await prisma.venteDirecte.findUnique({
      where: { id: venteId },
      include: {
        vendeur: { select: { id: true, nom: true, prenom: true } },
        lignes:  { include: { produit: { select: { nom: true } } } },
        pointDeVente: { select: { id: true, nom: true } },
      },
    });

    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
    if (vente.statut !== "BROUILLON") {
      return NextResponse.json({ error: `Impossible : statut actuel "${vente.statut}"` }, { status: 400 });
    }
    // Vérifier que la vente appartient au PDV du RPV
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: parseInt(session.user.id), actif: true },
      select: { pointDeVenteId: true },
    });
    if (!aff || aff.pointDeVenteId !== vente.pointDeVenteId) {
      return NextResponse.json({ error: "Cette vente n'appartient pas à votre PDV" }, { status: 403 });
    }

    const nouveauStatut = action === "CONFIRMER" ? "CONFIRMEE" : "ANNULEE";

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.venteDirecte.update({
        where: { id: venteId },
        data: { statut: nouveauStatut },
        include: { lignes: { include: { produit: { select: { nom: true } } } } },
      });

      await auditLog(tx, parseInt(session.user.id), `VENTE_TERRAIN_${nouveauStatut}`, "VenteDirecte", venteId);

      const agentNom = `${vente.vendeur.prenom} ${vente.vendeur.nom}`;
      const rpvNom   = `${session.user.prenom} ${session.user.nom}`;

      if (action === "CONFIRMER") {
        // Notifier le magasinier pour qu'il prépare la livraison
        await notifyRoles(tx, ["MAGAZINIER"], {
          titre:    `Vente terrain à livrer — ${vente.reference}`,
          message:  `Le RPV ${rpvNom} a validé la vente terrain ${vente.reference} (${Number(vente.montantTotal).toLocaleString("fr-FR")} FCFA). Préparez et confirmez la livraison depuis votre tableau de bord.`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl:`/dashboard/user/magasiniers`,
        });
        // Notifier l'agent terrain
        await notifyRoles(tx, ["AGENT_TERRAIN"], {
          titre:    `Vente ${vente.reference} confirmée`,
          message:  `Le RPV ${rpvNom} a validé votre demande de vente terrain. Le magasinier va préparer la livraison.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl:`/dashboard/user/agentsTerrain`,
        });
      } else {
        // Notifier l'agent du refus
        await notifyRoles(tx, ["AGENT_TERRAIN"], {
          titre:    `Vente ${vente.reference} refusée`,
          message:  `Le RPV ${rpvNom} a refusé votre demande de vente terrain.${motifRefus ? ` Motif : ${motifRefus}` : ""}`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl:`/dashboard/user/agentsTerrain`,
        });
        // Notifier l'agent
        await notifyRoles(tx, ["AGENT_TERRAIN"], {
          titre:    `Demande refusée : ${vente.reference}`,
          message:  `RPV ${rpvNom} : ${motifRefus || "Demande non approuvée."}`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl:`/dashboard/user/agentsTerrain`,
        });
      }

      return result;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /rpv/ventes-terrain/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
