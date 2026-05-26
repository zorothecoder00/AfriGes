import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { notifyRoles, auditLog } from "@/lib/notifications";
import { PrioriteNotification, StatutVenteDirecte } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/rvc/ventes/[id]/traiter
 *
 * Traitement d'une demande de vente à crédit (statut CREDIT_REQUEST).
 *
 * Body :
 *  { action: "APPROUVER" }
 *  { action: "REFUSER", motif: string }
 *
 * APPROUVER → statut CREDIT_APPROUVE + soldeActuel client mis à jour + notif agent + RPV
 * REFUSER   → statut CREDIT_REFUSE  + notif agent + RPV (motif obligatoire)
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const venteId = parseInt(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { action, motif } = body as { action: "APPROUVER" | "REFUSER"; motif?: string };

    if (action !== "APPROUVER" && action !== "REFUSER") {
      return NextResponse.json({ error: "action doit être APPROUVER ou REFUSER" }, { status: 400 });
    }
    if (action === "REFUSER" && !motif?.trim()) {
      return NextResponse.json({ error: "motif est requis pour un refus" }, { status: 400 });
    }

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    // Résolution du PDV du RVC
    let rvcPdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId: parseInt(session.user.id), actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff) {
        return NextResponse.json({ error: "Aucun point de vente associé à ce responsable crédit" }, { status: 400 });
      }
      rvcPdvId = aff.pointDeVenteId;
    }

    const vente = await prisma.venteDirecte.findUnique({
      where: { id: venteId },
      include: {
        client:      { select: { id: true, nom: true, prenom: true, soldeActuel: true, limiteCredit: true } },
        vendeur:     { select: { id: true, nom: true, prenom: true } },
        pointDeVente:{ select: { id: true, nom: true, rpvId: true } },
      },
    });

    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });

    // Vérifier que la vente appartient bien au PDV du RVC
    if (rvcPdvId !== null && vente.pointDeVenteId !== rvcPdvId) {
      return NextResponse.json({ error: "Cette vente n'appartient pas à votre point de vente" }, { status: 403 });
    }

    if (vente.statut !== StatutVenteDirecte.CREDIT_REQUEST) {
      return NextResponse.json(
        { error: `Cette vente est déjà en statut "${vente.statut}", impossible de la retraiter.` },
        { status: 409 }
      );
    }

    const rvcId = parseInt(session.user.id);

    const result = await prisma.$transaction(async (tx) => {
      const newStatut = action === "APPROUVER"
        ? StatutVenteDirecte.CREDIT_APPROUVE
        : StatutVenteDirecte.CREDIT_REFUSE;

      const updated = await tx.venteDirecte.update({
        where: { id: venteId },
        data:  { statut: newStatut },
      });

      if (action === "APPROUVER" && vente.client) {
        // Incrémenter le solde actuel du client (montant engagé à crédit)
        await tx.client.update({
          where: { id: vente.client.id },
          data:  { soldeActuel: { increment: Number(vente.montantTotal) } },
        });
      }

      await auditLog(
        tx, rvcId,
        action === "APPROUVER" ? "VENTE_CREDIT_APPROUVEE" : "VENTE_CREDIT_REFUSEE",
        "VenteDirecte",
        venteId
      );

      const montantFmt = Number(vente.montantTotal).toLocaleString("fr-FR");
      const agentNom   = `${vente.vendeur.prenom} ${vente.vendeur.nom}`;
      const clientNom  = vente.client
        ? `${vente.client.prenom} ${vente.client.nom}`
        : (vente.clientNom ?? "client inconnu");
      const rvcNom     = `${session.user.prenom} ${session.user.nom}`;
      const pdvNom     = vente.pointDeVente.nom;

      // Notifier l'agent qui a fait la demande
      await tx.notification.create({
        data: {
          userId:   vente.vendeurId,
          titre:    action === "APPROUVER" ? "Crédit approuvé" : "Crédit refusé",
          message:  action === "APPROUVER"
            ? `Votre demande de vente à crédit de ${montantFmt} FCFA pour ${clientNom} a été approuvée par ${rvcNom}.`
            : `Votre demande de vente à crédit de ${montantFmt} FCFA pour ${clientNom} a été refusée. Motif : ${motif}`,
          priorite: action === "APPROUVER" ? PrioriteNotification.NORMAL : PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/user/agentsTerrain`,
        },
      });

      // Notifier RPV + Admin
      await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE"], {
        titre:    action === "APPROUVER" ? `Crédit approuvé — ${vente.reference}` : `Crédit refusé — ${vente.reference}`,
        message:  action === "APPROUVER"
          ? `${rvcNom} a approuvé la vente à crédit de ${agentNom} (${montantFmt} FCFA pour ${clientNom}) sur "${pdvNom}".`
          : `${rvcNom} a refusé la vente à crédit de ${agentNom} (${montantFmt} FCFA pour ${clientNom}). Motif : ${motif}`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/user/responsablesPointDeVente`,
      });

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("POST /api/rvc/ventes/[id]/traiter error:", error);
    return NextResponse.json({ error: "Erreur lors du traitement" }, { status: 500 });
  }
}
