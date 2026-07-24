import { NextResponse } from "next/server";
import { StatutLivraisonPO } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getSession } from "../../../../fournisseurs/route";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/logistique/bons-commande/[id]/importation/evenements
 * Ajoute un checkpoint de suivi (CDC §9 "suivi temps réel" — saisie manuelle).
 * Si `statut` est fourni, synchronise aussi BonCommande.statutLivraison
 * (même échelle que le suivi livraison standard, cf. .../livraison).
 * Body: { date?, statut?, lieu?, commentaire? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const bonId = Number(id);
    const importation = await prisma.importation.findUnique({ where: { bonCommandeId: bonId } });
    if (!importation) return NextResponse.json({ error: "Aucun suivi import pour ce bon de commande" }, { status: 404 });

    const body = await req.json();
    const { date, statut, lieu, commentaire } = body;
    if (statut && !Object.values(StatutLivraisonPO).includes(statut)) {
      return NextResponse.json({ error: "statut invalide" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);
    const evenement = await prisma.$transaction(async (tx) => {
      const e = await tx.evenementImportation.create({
        data: {
          importationId: importation.id,
          date: date ? new Date(date) : new Date(),
          statut: statut || null, lieu: lieu || null, commentaire: commentaire || null,
          creeParId: userId,
        },
        include: { creePar: { select: { id: true, nom: true, prenom: true } } },
      });

      if (statut) {
        const bon = await tx.bonCommande.findUnique({ where: { id: bonId }, select: { statut: true } });
        if (bon && ["SENT", "ACKNOWLEDGED", "PARTIALLY_DELIVERED"].includes(bon.statut)) {
          await tx.bonCommande.update({ where: { id: bonId }, data: { statutLivraison: statut } });
        }
      }

      await auditLog(tx, userId, "IMPORTATION_EVENEMENT_AJOUTE", "EvenementImportation", e.id);
      return e;
    });

    return NextResponse.json({ data: evenement }, { status: 201 });
  } catch (error) {
    console.error("POST /logistique/bons-commande/[id]/importation/evenements:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
