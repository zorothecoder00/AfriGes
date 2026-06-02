import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { notifyRoles, auditLog } from "@/lib/notifications";
import { PrioriteNotification } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/magasinier/ventes-credit/[id]/confirmer
 *
 * Magasinier confirme la sortie de stock pour une livraison crédit.
 * CREDIT_EN_LIVRAISON → CREDIT_LIVRE
 *
 * Actions effectuées :
 *  1. Pour chaque ligne catalogue : décrémente stock + libère réservation + crée MouvementStock
 *  2. Met à jour creditClient.montantConsomme += montantTotal
 *  3. Met à jour client.soldeActuel += montantTotal
 *  4. Statut → CREDIT_LIVRE
 *  5. Notifie agent + RVC + RPV
 *
 * Les lignes hors catalogue (produitId null) sont ignorées pour le stock
 * (produit inexistant dans le catalogue — à créer séparément).
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const venteId = parseInt(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const magId   = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    let magPdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId: magId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff) return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });
      magPdvId = aff.pointDeVenteId;
    }

    const vente = await prisma.venteDirecte.findUnique({
      where: { id: venteId },
      include: {
        vendeur:      { select: { id: true, nom: true, prenom: true } },
        pointDeVente: { select: { id: true, nom: true } },
        client:       { select: { id: true, nom: true, prenom: true } },
        creditClient: { select: { id: true, reference: true, montantTotal: true, montantConsomme: true, statut: true } },
        lignes:       { select: { id: true, produitId: true, produitNom: true, quantite: true, montant: true } },
      },
    });

    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
    if (magPdvId !== null && vente.pointDeVenteId !== magPdvId) {
      return NextResponse.json({ error: "Cette vente n'appartient pas à votre point de vente" }, { status: 403 });
    }
    if (vente.statut !== "CREDIT_EN_LIVRAISON") {
      return NextResponse.json(
        { error: `Statut actuel "${vente.statut}" — la vente doit être CREDIT_EN_LIVRAISON.` },
        { status: 409 }
      );
    }

    const pdvId      = vente.pointDeVenteId;
    const montant    = Number(vente.montantTotal);
    const magNom     = `${session.user.prenom} ${session.user.nom}`;
    const clientNom  = vente.client
      ? `${vente.client.prenom} ${vente.client.nom}`
      : (vente.clientNom ?? "client inconnu");
    const montantFmt = montant.toLocaleString("fr-FR");

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Sortie de stock pour les lignes catalogue
      for (const ligne of vente.lignes) {
        if (!ligne.produitId) continue; // hors catalogue : pas de stock à sortir

        await tx.stockSite.update({
          where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: pdvId } },
          data: {
            quantite:         { decrement: ligne.quantite },
            quantiteReservee: { decrement: ligne.quantite },
          },
        });

        await tx.mouvementStock.create({
          data: {
            produitId:      ligne.produitId,
            pointDeVenteId: pdvId,
            type:           "SORTIE",
            typeSortie:     "LIVRAISON_CLIENT",
            quantite:       ligne.quantite,
            motif:          `Livraison crédit confirmée — ${vente.reference}`,
            reference:      `${vente.reference}-P${ligne.produitId}-LIV`,
            operateurId:    magId,
            venteDirecteId: venteId,
          },
        });
      }

      // 2. Mettre à jour creditClient.montantConsomme
      if (vente.creditClient) {
        await tx.creditClient.update({
          where: { id: vente.creditClient.id },
          data:  { montantConsomme: { increment: montant } },
        });
      }

      // 3. Mettre à jour client.soldeActuel
      if (vente.clientId) {
        await tx.client.update({
          where: { id: vente.clientId },
          data:  { soldeActuel: { increment: montant } },
        });
      }

      // 4. Passer au statut CREDIT_LIVRE
      const v = await tx.venteDirecte.update({
        where: { id: venteId },
        data:  { statut: "CREDIT_LIVRE" },
      });

      await auditLog(tx, magId, "VENTE_CREDIT_LIVRE", "VenteDirecte", venteId);

      // 5. Notifications

      // Agent
      await tx.notification.create({
        data: {
          userId:    vente.vendeurId,
          titre:     `Livraison confirmée — ${vente.reference}`,
          message:   `${magNom} a confirmé la sortie de stock pour votre livraison à crédit de ${montantFmt} FCFA pour ${clientNom}.`,
          priorite:  PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/agentsTerrain`,
        },
      });

      // RVC du PDV
      const rvcsDuPdv = await tx.gestionnaireAffectation.findMany({
        where: {
          pointDeVenteId: pdvId,
          actif: true,
          user: { gestionnaire: { role: "RESPONSABLE_VENTE_CREDIT", actif: true } },
        },
        select: { userId: true },
      });
      if (rvcsDuPdv.length > 0) {
        await tx.notification.createMany({
          data: rvcsDuPdv.map(({ userId: uid }) => ({
            userId:    uid,
            titre:     `Livraison crédit effectuée — ${vente.reference}`,
            message:   `Stock sorti par ${magNom} pour la livraison de ${montantFmt} FCFA à ${clientNom} sur "${vente.pointDeVente.nom}".`,
            priorite:  PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/user/responsablesVenteCredit`,
          })),
          skipDuplicates: true,
        });
      }

      await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE"], {
        titre:     `Livraison crédit — ${vente.reference}`,
        message:   `Livraison crédit de ${montantFmt} FCFA à ${clientNom} confirmée par ${magNom} sur "${vente.pointDeVente.nom}".`,
        priorite:  PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/user/responsablesPointDeVente`,
      });

      return v;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("POST /api/magasinier/ventes-credit/[id]/confirmer:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
