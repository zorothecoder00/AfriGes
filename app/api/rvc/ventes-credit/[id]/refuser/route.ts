import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { auditLog } from "@/lib/notifications";
import { PrioriteNotification } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/rvc/ventes-credit/[id]/refuser
 *
 * Body: { motif: string }
 * → Libère les réservations stock (produits catalogue)
 * → Statut CREDIT_REFUSE
 * → Notifie l'agent
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const venteId = parseInt(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { motif } = body as { motif?: string };
    if (!motif?.trim()) {
      return NextResponse.json({ error: "motif est obligatoire pour un refus" }, { status: 400 });
    }

    const rvcId   = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    let rvcPdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId: rvcId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff) return NextResponse.json({ error: "Aucun point de vente associé au RVC" }, { status: 400 });
      rvcPdvId = aff.pointDeVenteId;
    }

    const vente = await prisma.venteDirecte.findUnique({
      where: { id: venteId },
      include: {
        vendeur: { select: { id: true, nom: true, prenom: true } },
        client:  { select: { id: true, nom: true, prenom: true } },
        lignes:  { select: { produitId: true, quantite: true } },
      },
    });

    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
    if (rvcPdvId !== null && vente.pointDeVenteId !== rvcPdvId) {
      return NextResponse.json({ error: "Cette vente n'appartient pas à votre point de vente" }, { status: 403 });
    }
    if (vente.statut !== "CREDIT_REQUEST") {
      return NextResponse.json({ error: `Statut actuel "${vente.statut}" — impossible de refuser.` }, { status: 409 });
    }

    const rvcNom    = `${session.user.prenom} ${session.user.nom}`;
    const clientNom = vente.client
      ? `${vente.client.prenom} ${vente.client.nom}`
      : (vente.clientNom ?? "client inconnu");
    const montantFmt = Number(vente.montantTotal).toLocaleString("fr-FR");
    const pdvId      = vente.pointDeVenteId;

    const updated = await prisma.$transaction(async (tx) => {
      const v = await tx.venteDirecte.update({
        where: { id: venteId },
        data:  { statut: "CREDIT_REFUSE" },
      });

      // Libérer les réservations stock pour les lignes catalogue
      for (const ligne of vente.lignes) {
        if (!ligne.produitId) continue;
        await tx.stockSite.update({
          where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: pdvId } },
          data:  { quantiteReservee: { decrement: ligne.quantite } },
        });
      }

      await auditLog(tx, rvcId, "VENTE_CREDIT_REFUSEE", "VenteDirecte", venteId);

      await tx.notification.create({
        data: {
          userId:    vente.vendeurId,
          titre:     "Crédit refusé",
          message:   `Votre demande de vente à crédit de ${montantFmt} FCFA pour ${clientNom} a été refusée par ${rvcNom}. Motif : ${motif}`,
          priorite:  PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/user/agentsTerrain`,
        },
      });

      return v;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("POST /api/rvc/ventes-credit/[id]/refuser:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
