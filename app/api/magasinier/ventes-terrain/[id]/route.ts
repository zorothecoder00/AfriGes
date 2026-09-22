import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { consommerFEFOBestEffort } from "@/lib/lotsFefo";
import { creerEcritureVenteDepuisVenteDirecte, creerEcritureCogsVenteDirecte } from "@/lib/ecritureVenteServer";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/magasinier/ventes-terrain/[id]
 * Le magasinier valide la sortie physique du stock pour une vente terrain CONFIRMEE.
 * Conséquences :
 *  - VenteDirecte CONFIRMEE → SORTIE_VALIDEE
 *  - StockSite décrémenté par produit (PDV du magasinier)
 *  - MouvementStock SORTIE VENTE_DIRECTE créé par produit
 *  - Notification à l'agent terrain pour qu'il procède à la livraison
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
      if (!l.produitId) continue;
      const stock = await prisma.stockSite.findUnique({
        where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: pdvId } },
        include: { produit: { select: { nom: true } } },
      });
      const qteDispo = (stock?.quantite ?? 0) - (stock?.quantiteReservee ?? 0);
      if (!stock || qteDispo < l.quantite) {
        return NextResponse.json(
          { error: `Stock insuffisant pour "${stock?.produit.nom ?? l.produitId}". Disponible : ${qteDispo}, requis : ${l.quantite}` },
          { status: 400 }
        );
      }
    }

    const magasinierNom = `${session.user.prenom} ${session.user.nom}`;

    const updated = await prisma.$transaction(async (tx) => {
      // Décrémenter StockSite (stock réel + libération de la réservation du
      // lancement) + créer MouvementStock pour chaque ligne
      for (const l of vente.lignes) {
        if (!l.produitId) continue;
        await tx.stockSite.update({
          where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: pdvId } },
          data: {
            quantite:         { decrement: l.quantite },
            quantiteReservee: { decrement: l.quantite },
          },
        });
        await tx.mouvementStock.create({
          data: {
            produitId:      l.produitId,
            pointDeVenteId: pdvId,
            type:           "SORTIE",
            typeSortie:     "VENTE_DIRECTE",
            quantite:       l.quantite,
            motif:          `Sortie stock vente terrain ${vente.reference} — ${magasinierNom}`,
            reference:      `${vente.reference}-P${l.produitId}-${randomUUID().slice(0, 6)}`,
            operateurId:    parseInt(session.user.id),
            venteDirecteId: vente.id,
          },
        });
        // Déstockage FEFO best-effort (traçabilité lots/péremption, Enterprise #5).
        await consommerFEFOBestEffort(tx, {
          produitId: l.produitId, pointDeVenteId: pdvId, quantite: l.quantite,
          operateurId: parseInt(session.user.id), motif: `Sortie stock vente terrain ${vente.reference}`,
        });
      }

      const result = await tx.venteDirecte.update({
        where: { id: venteId },
        data:  { statut: "SORTIE_VALIDEE" },
        include: { lignes: { include: { produit: { select: { id: true, nom: true } } } } },
      });

      // Écriture comptable automatique (CDC §8/§54) — moteur central. C'est ICI, à
      // la sortie physique réelle du stock (validée par le magasinier), que la
      // vente terrain devient définitive comptablement — pas au lancement par
      // l'agent (BROUILLON), qui reste annulable jusque-là.
      await creerEcritureVenteDepuisVenteDirecte(tx, venteId, parseInt(session.user.id));
      await creerEcritureCogsVenteDirecte(tx, venteId, parseInt(session.user.id));

      await auditLog(tx, parseInt(session.user.id), "VENTE_TERRAIN_SORTIE_VALIDEE", "VenteDirecte", venteId);

      const clientNom = vente.client
        ? `${vente.client.prenom} ${vente.client.nom}`
        : vente.clientNom ?? "Client inconnu";

      // Notifier le RPV
      // Vérifier si le vendeur est bien un agent terrain via ses affectations
      const vendeurAffectation = vente.vendeurId
        ? await tx.gestionnaireAffectation.findFirst({
            where: { userId: vente.vendeurId, actif: true },
            select: { user: { select: { gestionnaire: { select: { role: true } } } } },
          })
        : null;
      const estVenteAgentTerrain = vendeurAffectation?.user?.gestionnaire?.role === "AGENT_TERRAIN";

      await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE"], {
        titre:    `Sortie stock validée — ${vente.reference}`,
        message:  `Le magasinier ${magasinierNom} a validé la sortie stock pour la vente ${vente.reference} (client : "${clientNom}"). Les produits sont prêts à être livrés.${estVenteAgentTerrain ? " L'agent terrain peut procéder à la livraison." : ""}`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl:`/dashboard/user/responsablesPointDeVente`,
      });

      // Notifier l'agent terrain uniquement si c'est lui qui a fait la vente
      if (estVenteAgentTerrain && vente.vendeurId) {
        await notifyRoles(tx, ["AGENT_TERRAIN"], {
          titre:    `Stock prêt — livrez la vente ${vente.reference}`,
          message:  `Le magasinier ${magasinierNom} a sorti les produits du stock. Vous pouvez maintenant livrer "${clientNom}".`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl:`/dashboard/agentTerrain/ventes`,
        });
      }

      return result;
    });

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    console.error("PATCH /magasinier/ventes-terrain/[id]:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
