import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { auditLog } from "@/lib/notifications";
import { PrioriteNotification } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/agentTerrain/ventes-credit/[id]/partir-livrer
 *
 * L'agent signale qu'il part livrer une vente à crédit approuvée.
 * CREDIT_APPROUVE → CREDIT_EN_LIVRAISON
 * → Notifie le(s) magasinier(s) du PDV
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const venteId = parseInt(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId = parseInt(session.user.id);

    const vente = await prisma.venteDirecte.findUnique({
      where: { id: venteId },
      include: {
        pointDeVente: { select: { id: true, nom: true } },
        client:       { select: { id: true, nom: true, prenom: true } },
        lignes: {
          include: { produit: { select: { nom: true, unite: true } } },
        },
      },
    });

    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
    if (vente.vendeurId !== userId) {
      return NextResponse.json({ error: "Vous n'êtes pas le vendeur de cette vente" }, { status: 403 });
    }
    if (vente.statut !== "CREDIT_APPROUVE") {
      return NextResponse.json(
        { error: `Statut actuel "${vente.statut}" — la vente doit être CREDIT_APPROUVE pour partir livrer.` },
        { status: 409 }
      );
    }

    const clientNom  = vente.client
      ? `${vente.client.prenom} ${vente.client.nom}`
      : (vente.clientNom ?? "client inconnu");
    const agentNom   = `${session.user.prenom} ${session.user.nom}`;
    const montantFmt = Number(vente.montantTotal).toLocaleString("fr-FR");
    const pdvId      = vente.pointDeVenteId;

    const updated = await prisma.$transaction(async (tx) => {
      const v = await tx.venteDirecte.update({
        where: { id: venteId },
        data:  { statut: "CREDIT_EN_LIVRAISON" },
      });

      await auditLog(tx, userId, "VENTE_CREDIT_EN_LIVRAISON", "VenteDirecte", venteId);

      // Notifier les magasiniers du PDV
      const magasiniers = await tx.gestionnaireAffectation.findMany({
        where: {
          pointDeVenteId: pdvId,
          actif: true,
          user: { gestionnaire: { role: "MAGAZINIER", actif: true } },
        },
        select: { userId: true },
      });

      if (magasiniers.length > 0) {
        const lignesResume = vente.lignes
          .map((l) => `${l.produit?.nom ?? l.produitNom ?? "—"} × ${l.quantite}`)
          .join(", ");

        await tx.notification.createMany({
          data: magasiniers.map(({ userId: uid }) => ({
            userId:    uid,
            titre:     `Livraison crédit en cours — ${vente.reference}`,
            message:   `${agentNom} est parti livrer ${montantFmt} FCFA à ${clientNom} (${vente.pointDeVente.nom}). Produits : ${lignesResume}. Confirmez la sortie de stock à réception.`,
            priorite:  PrioriteNotification.HAUTE,
            actionUrl: `/dashboard/user/magasiniers`,
          })),
          skipDuplicates: true,
        });
      }

      return v;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("POST /api/agentTerrain/ventes-credit/[id]/partir-livrer:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
