import { NextResponse } from "next/server";
import { StatutLivraisonPO } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getSession } from "../../../fournisseurs/route";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

const ORDRE: StatutLivraisonPO[] = ["PREPARATION", "EXPEDIEE", "EN_TRANSIT", "DOUANE", "LIVREE", "RECEPTIONNEE"];

/**
 * PATCH /api/logistique/bons-commande/[id]/livraison
 * Suivi logistique de la livraison (CDC §7 étape 8) — statut indépendant du
 * statut principal du PO. Purement déclaratif : ne touche pas le stock réel
 * (StockSite), qui reste alimenté par le flux de réception existant
 * (ReceptionApprovisionnement). À RECEPTIONNEE, si des quantités reçues par
 * ligne sont fournies, le statut principal passe à COMPLETED (tout reçu) ou
 * PARTIALLY_DELIVERED (reçu partiel).
 * Body: { statutLivraison, lignes?: [{ ligneId, quantiteRecue }] }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const bonId = Number(id);
    const bon = await prisma.bonCommande.findUnique({ where: { id: bonId }, include: { lignes: true } });
    if (!bon) return NextResponse.json({ error: "Bon de commande introuvable" }, { status: 404 });
    if (!["SENT", "ACKNOWLEDGED", "PARTIALLY_DELIVERED"].includes(bon.statut)) {
      return NextResponse.json({ error: "Le suivi de livraison n'est disponible qu'après l'envoi du bon" }, { status: 422 });
    }

    const { statutLivraison, lignes } = await req.json();
    if (!statutLivraison || !ORDRE.includes(statutLivraison)) {
      return NextResponse.json({ error: "statutLivraison invalide" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);

    const updated = await prisma.$transaction(async (tx) => {
      if (Array.isArray(lignes) && lignes.length > 0) {
        for (const l of lignes) {
          if (!l.ligneId || l.quantiteRecue == null) continue;
          await tx.ligneBonCommande.update({
            where: { id: Number(l.ligneId) },
            data: { quantiteRecue: Number(l.quantiteRecue) },
          });
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = { statutLivraison };

      if (statutLivraison === "RECEPTIONNEE") {
        const lignesActuelles = await tx.ligneBonCommande.findMany({ where: { bonCommandeId: bonId } });
        const totalCommande = lignesActuelles.reduce((s, l) => s + l.quantite, 0);
        const totalRecu = lignesActuelles.reduce((s, l) => s + l.quantiteRecue, 0);
        data.statut = totalRecu >= totalCommande ? "COMPLETED" : "PARTIALLY_DELIVERED";
      }

      const b = await tx.bonCommande.update({
        where: { id: bonId },
        data,
        include: {
          fournisseur: { select: { id: true, nom: true, code: true } },
          pointDeVente: { select: { id: true, nom: true, code: true } },
          lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true } } } },
        },
      });
      await auditLog(tx, userId, "PO_LIVRAISON_MAJ", "BonCommande", bonId, { statutLivraison }, getRequestMeta(req));
      return b;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /logistique/bons-commande/[id]/livraison:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
