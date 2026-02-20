import { NextResponse } from "next/server";
import { Role, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/ventes/[id]
 * Détail d'une vente par crédit alimentaire.
 * Accessible par tout utilisateur authentifié.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const { id } = await params;
    const venteId = Number(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const vente = await prisma.venteCreditAlimentaire.findUnique({
      where: { id: venteId },
      include: {
        produit: {
          select: { id: true, nom: true, prixUnitaire: true, stock: true, description: true },
        },
        creditAlimentaire: {
          select: {
            id: true,
            plafond: true,
            montantUtilise: true,
            montantRestant: true,
            statut: true,
            source: true,
            sourceId: true,
            dateAttribution: true,
            dateExpiration: true,
            member: {
              select: { id: true, nom: true, prenom: true, email: true },
            },
            client: {
              select: { id: true, nom: true, prenom: true, telephone: true },
            },
          },
        },
      },
    });

    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });

    return NextResponse.json({ data: vente });
  } catch (error) {
    console.error("GET /api/admin/ventes/[id] error:", error);
    return NextResponse.json({ error: "Erreur lors de la recuperation de la vente" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/ventes/[id]
 * Annule une vente : supprime l'enregistrement et recrédite le montant sur le crédit alimentaire.
 * Réservé ADMIN / SUPER_ADMIN.
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id } = await params;
    const venteId = Number(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const vente = await prisma.venteCreditAlimentaire.findUnique({
      where: { id: venteId },
      include: {
        produit: { select: { id: true, nom: true } },
        creditAlimentaire: {
          select: {
            id: true,
            plafond: true,
            montantUtilise: true,
            montantRestant: true,
            statut: true,
            member: { select: { nom: true, prenom: true } },
            client: { select: { nom: true, prenom: true } },
          },
        },
      },
    });

    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });

    const montantVente = Number(vente.prixUnitaire) * vente.quantite;
    const credit = vente.creditAlimentaire;

    const newUtilise = Math.max(0, Number(credit.montantUtilise) - montantVente);
    const newRestant = Number(credit.plafond) - newUtilise;
    const newStatut =
      newRestant <= 0 ? "EPUISE" : credit.statut === "EPUISE" ? "ACTIF" : credit.statut;

    const clientNom =
      credit.member
        ? `${credit.member.prenom} ${credit.member.nom}`
        : credit.client
        ? `${credit.client.prenom} ${credit.client.nom}`
        : "Client inconnu";

    await prisma.$transaction(async (tx) => {
      // Supprimer la vente
      await tx.venteCreditAlimentaire.delete({ where: { id: venteId } });

      // Recréditer le crédit alimentaire
      await tx.creditAlimentaire.update({
        where: { id: credit.id },
        data: {
          montantUtilise: newUtilise,
          montantRestant: newRestant,
          statut: newStatut,
        },
      });

      // Remettre le stock du produit
      await tx.produit.update({
        where: { id: vente.produitId },
        data: { stock: { increment: vente.quantite } },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: parseInt(session.user.id),
          action: "ANNULATION_VENTE",
          entite: "VenteCreditAlimentaire",
          entiteId: venteId,
        },
      });

      // Notifications admins
      const admins = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });

      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((u) => ({
            userId: u.id,
            titre: "Vente annulée",
            message: `La vente #${venteId} (${vente.quantite} × ${vente.produit.nom}) de ${clientNom} a été annulée. Crédit recredité de ${montantVente} FCFA.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/admin/creditsAlimentaires/${credit.id}`,
          })),
        });
      }
    });

    return NextResponse.json({ message: "Vente annulee avec succes" });
  } catch (error) {
    console.error("DELETE /api/admin/ventes/[id] error:", error);
    return NextResponse.json({ error: "Erreur lors de l'annulation de la vente" }, { status: 500 });
  }
}
