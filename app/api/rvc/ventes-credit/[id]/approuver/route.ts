import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { notifyRoles, auditLog } from "@/lib/notifications";
import { PrioriteNotification } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/rvc/ventes-credit/[id]/approuver
 *
 * Approuve une demande CREDIT_REQUEST liée à un CreditClient.
 * → Statut CREDIT_APPROUVE
 * → Aucun décrément stock (différé à la confirmation magasinier)
 * → Vérifie que montantTotal - montantConsomme du CreditClient >= montantVente
 * → Notifie l'agent + RPV
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const venteId = parseInt(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

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
        vendeur:      { select: { id: true, nom: true, prenom: true } },
        pointDeVente: { select: { id: true, nom: true } },
        client:       { select: { id: true, nom: true, prenom: true } },
        creditClient: {
          select: { id: true, montantTotal: true, montantConsomme: true, statut: true },
        },
        lignes: { select: { id: true, produitId: true, produitNom: true } },
      },
    });

    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
    if (rvcPdvId !== null && vente.pointDeVenteId !== rvcPdvId) {
      return NextResponse.json({ error: "Cette vente n'appartient pas à votre point de vente" }, { status: 403 });
    }
    if (vente.statut !== "CREDIT_REQUEST") {
      return NextResponse.json({ error: `Statut actuel "${vente.statut}" — impossible d'approuver.` }, { status: 409 });
    }
    if (!vente.creditClient) {
      return NextResponse.json(
        { error: "Cette vente n'est pas liée à un CreditClient. Utilisez l'ancien flux (/api/rvc/ventes/[id]/traiter)." },
        { status: 400 }
      );
    }

    // Vérifier disponibilité crédit
    const soldeDisponible = Number(vente.creditClient.montantTotal) - Number(vente.creditClient.montantConsomme);
    if (Number(vente.montantTotal) > soldeDisponible) {
      return NextResponse.json(
        {
          error: `Solde crédit insuffisant. Disponible : ${soldeDisponible.toLocaleString("fr-FR")} FCFA — Demandé : ${Number(vente.montantTotal).toLocaleString("fr-FR")} FCFA`,
        },
        { status: 400 }
      );
    }

    // Vérifier que les lignes hors catalogue ont toutes un produitId ou un produitNom
    const horscat = vente.lignes.filter((l) => !l.produitId);
    if (horscat.length > 0) {
      const noms = horscat.map((l) => l.produitNom ?? "—").join(", ");
      // Avertissement non bloquant — le RVC peut approuver avec des produits en attente de création
      // La sortie de stock ne sera effectuée que pour les produits catalogue lors de la confirmation magasinier
      console.info(`Approbation avec ${horscat.length} ligne(s) hors catalogue : ${noms}`);
    }

    const rvcNom    = `${session.user.prenom} ${session.user.nom}`;
    const clientNom = vente.client
      ? `${vente.client.prenom} ${vente.client.nom}`
      : (vente.clientNom ?? "client inconnu");
    const montantFmt = Number(vente.montantTotal).toLocaleString("fr-FR");

    const updated = await prisma.$transaction(async (tx) => {
      const v = await tx.venteDirecte.update({
        where: { id: venteId },
        data:  { statut: "CREDIT_APPROUVE" },
      });

      await auditLog(tx, rvcId, "VENTE_CREDIT_APPROUVEE", "VenteDirecte", venteId);

      // Notifier l'agent
      await tx.notification.create({
        data: {
          userId:    vente.vendeurId,
          titre:     "Crédit approuvé — vous pouvez partir livrer",
          message:   `Votre demande de vente à crédit de ${montantFmt} FCFA pour ${clientNom} a été approuvée par ${rvcNom}. Lancez la livraison quand vous êtes prêt.`,
          priorite:  PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/user/agentsTerrain`,
        },
      });

      await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE"], {
        titre:     `Crédit approuvé — ${vente.reference}`,
        message:   `${rvcNom} a approuvé la vente à crédit de ${Number(vente.montantTotal).toLocaleString("fr-FR")} FCFA pour ${clientNom} sur "${vente.pointDeVente.nom}".`,
        priorite:  PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/user/responsablesPointDeVente`,
      });

      return v;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("POST /api/rvc/ventes-credit/[id]/approuver:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
