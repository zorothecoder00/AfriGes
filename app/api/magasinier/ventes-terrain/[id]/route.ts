import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { auditLog, notifyRoles } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/magasinier/ventes-terrain/[id]
 * Le magasinier confirme la livraison physique d'une vente terrain CONFIRMEE.
 * Conséquences :
 *  - VenteDirecte CONFIRMEE → LIVREE
 *  - StockSite décrémenté par produit (PDV du magasinier)
 *  - MouvementStock SORTIE VENTE_DIRECTE créé par produit
 *  - Notification à l'agent terrain et au RPV
 */
export async function PATCH(_req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const venteId = Number(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: parseInt(session.user.id), actif: true },
      select: { pointDeVenteId: true },
    });
    if (!aff?.pointDeVenteId) {
      return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });
    }
    const pdvId = aff.pointDeVenteId;

    const vente = await prisma.venteDirecte.findUnique({
      where: { id: venteId },
      include: {
        lignes:      true,
        vendeur:     { select: { id: true, nom: true, prenom: true } },
        pointDeVente:{ select: { nom: true } },
        client:      { select: { nom: true, prenom: true } },
      },
    });

    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
    if (vente.pointDeVenteId !== pdvId) {
      return NextResponse.json({ error: "Cette vente n'appartient pas à votre PDV" }, { status: 403 });
    }
    if (vente.statut !== "CONFIRMEE") {
      return NextResponse.json({ error: `Impossible : statut actuel "${vente.statut}" (attendu : CONFIRMEE)` }, { status: 400 });
    }

    // Vérifier les stocks avant la transaction
    for (const l of vente.lignes) {
      const stock = await prisma.stockSite.findUnique({
        where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: pdvId } },
        include: { produit: { select: { nom: true } } },
      });
      if (!stock || stock.quantite < l.quantite) {
        return NextResponse.json(
          { error: `Stock insuffisant pour "${stock?.produit.nom ?? l.produitId}". Dispo : ${stock?.quantite ?? 0}, requis : ${l.quantite}` },
          { status: 400 }
        );
      }
    }

    const magasinierNom = `${session.user.prenom} ${session.user.nom}`;

    const updated = await prisma.$transaction(async (tx) => {
      // Décrémenter StockSite + créer MouvementStock pour chaque ligne
      for (const l of vente.lignes) {
        await tx.stockSite.update({
          where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: pdvId } },
          data: { quantite: { decrement: l.quantite } },
        });
        await tx.mouvementStock.create({
          data: {
            produitId:      l.produitId,
            pointDeVenteId: pdvId,
            type:           "SORTIE",
            typeSortie:     "VENTE_DIRECTE",
            quantite:       l.quantite,
            motif:          `Livraison vente terrain ${vente.reference} — ${magasinierNom}`,
            reference:      `${vente.reference}-P${l.produitId}`,
            operateurId:    parseInt(session.user.id),
            venteDirecteId: vente.id,
          },
        });
      }

      const result = await tx.venteDirecte.update({
        where: { id: venteId },
        data:  { statut: "LIVREE" },
        include: { lignes: { include: { produit: { select: { id: true, nom: true } } } } },
      });

      await auditLog(tx, parseInt(session.user.id), "VENTE_TERRAIN_LIVREE", "VenteDirecte", venteId);

      const clientNom = vente.client
        ? `${vente.client.prenom} ${vente.client.nom}`
        : vente.clientNom ?? "Client inconnu";

      // Notifier le RPV
      await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE"], {
        titre:    `Livraison confirmée — ${vente.reference}`,
        message:  `Le magasinier ${magasinierNom} a livré la vente terrain ${vente.reference} à "${clientNom}". Stock décrémenté sur "${vente.pointDeVente.nom}".`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl:`/dashboard/user/responsablesPointDeVente`,
      });

      // Notifier l'agent terrain
      await notifyRoles(tx, ["AGENT_TERRAIN"], {
        titre:    `Livraison effectuée — ${vente.reference}`,
        message:  `Le magasinier ${magasinierNom} a confirmé la livraison de votre vente terrain à "${clientNom}".`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl:`/dashboard/user/agentsTerrain`,
      });

      return result;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /magasinier/ventes-terrain/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
