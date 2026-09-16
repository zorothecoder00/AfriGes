import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * Bon de Préparation (CDC digitalisation §5.7) — liste de prélèvement du
 * magasinier, générée automatiquement avec le Bon de Sortie d'une Commande
 * Client. "Marquer prête" clôture la préparation et répercute les quantités
 * réellement prélevées sur le Bon de Sortie lié, ce qui débloque sa
 * confirmation d'expédition (cf. app/api/magasinier/bons-sortie/[id]/route.ts).
 */

type Ctx = { params: Promise<{ id: string }> };

const INCLUDE = {
  bonSortie: { select: { id: true, reference: true, statut: true } },
  commandeClient: { select: { id: true, reference: true } },
  preparateur: { select: { id: true, nom: true, prenom: true } },
  lignes: { include: { produit: { select: { id: true, nom: true } } } },
};

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const bp = await prisma.bonPreparation.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!bp) return NextResponse.json({ error: "Bon de préparation introuvable" }, { status: 404 });

    return NextResponse.json({ data: bp });
  } catch (error) {
    console.error("GET /magasinier/bons-preparation/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

interface LigneInput { id: number; quantitePreparee: number }

/**
 * PATCH /api/magasinier/bons-preparation/[id]
 * Body : { lignes?: [{ id, quantitePreparee }], commentaireEcart?, marquerPrete?: boolean }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const bpId = Number(id);
    const bp = await prisma.bonPreparation.findUnique({
      where: { id: bpId },
      include: { lignes: true, bonSortie: { select: { id: true } }, commandeClient: { select: { id: true, reference: true } } },
    });
    if (!bp) return NextResponse.json({ error: "Bon de préparation introuvable" }, { status: 404 });
    if (bp.statut !== "EN_COURS") {
      return NextResponse.json({ error: "Cette préparation est déjà clôturée" }, { status: 422 });
    }

    const body = await req.json();
    const lignesInput = (body.lignes ?? []) as LigneInput[];
    const userId = parseInt(session.user.id);

    const updated = await prisma.$transaction(async (tx) => {
      for (const li of lignesInput) {
        const ligne = bp.lignes.find((l) => l.id === Number(li.id));
        if (!ligne) continue;
        const q = Math.max(0, Math.min(ligne.quantiteDemandee, Math.round(Number(li.quantitePreparee) || 0)));
        await tx.ligneBonPreparation.update({ where: { id: ligne.id }, data: { quantitePreparee: q } });
      }

      if (!body.marquerPrete) {
        return tx.bonPreparation.findUnique({ where: { id: bpId }, include: INCLUDE });
      }

      const lignesFinales = await tx.ligneBonPreparation.findMany({ where: { bonPreparationId: bpId } });
      const aUnEcart = lignesFinales.some((l) => l.quantitePreparee < l.quantiteDemandee);
      const commentaireEcart = String(body.commentaireEcart || "").trim() || null;
      if (aUnEcart && !commentaireEcart) {
        throw new Error("ECART_SANS_COMMENTAIRE");
      }
      if (lignesFinales.every((l) => l.quantitePreparee === 0)) {
        throw new Error("PREPARATION_VIDE");
      }

      // Répercuter les quantités réellement prélevées sur le Bon de Sortie lié
      // (et revaloriser son montant total en conséquence).
      const lignesBS = await tx.ligneBonSortie.findMany({ where: { bonSortieId: bp.bonSortie.id } });
      let montantTotal = 0;
      for (const lf of lignesFinales) {
        const lbs = lignesBS.find((l) => l.produitId === lf.produitId);
        if (lbs) {
          await tx.ligneBonSortie.update({ where: { id: lbs.id }, data: { quantite: lf.quantitePreparee, quantiteDemandee: lf.quantiteDemandee } });
          montantTotal += lf.quantitePreparee * Number(lbs.prixUnit ?? 0);
        }
      }
      await tx.bonSortie.update({ where: { id: bp.bonSortie.id }, data: { commentaireEcart: aUnEcart ? commentaireEcart : null, montantTotal } });

      const result = await tx.bonPreparation.update({
        where: { id: bpId },
        data: { statut: "PRETE", preparateurId: userId, datePreparation: new Date(), commentaireEcart: aUnEcart ? commentaireEcart : null },
        include: INCLUDE,
      });

      await auditLog(tx, userId, "BON_PREPARATION_PRETE", "BonPreparation", bpId, { aUnEcart }, getRequestMeta(req));
      await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE"], {
        titre: `Commande préparée (${bp.commandeClient.reference})`,
        message: `${session.user.prenom} ${session.user.nom} a terminé la préparation — prête pour confirmation d'expédition.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/user/magasiniers?tab=sorties`,
      });

      return result;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "ECART_SANS_COMMENTAIRE") {
      return NextResponse.json({ error: "Quantité préparée inférieure à la quantité demandée sur au moins une ligne : un commentaire d'écart est obligatoire" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "PREPARATION_VIDE") {
      return NextResponse.json({ error: "Au moins un produit doit être préparé" }, { status: 400 });
    }
    console.error("PATCH /magasinier/bons-preparation/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
