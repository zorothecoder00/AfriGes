import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/magasinier/livraisons-rpv/[id]
 * Body : { action: "valider", lignes: [{ ligneId, quantiteRecue }] }
 *
 * Passe la réception EN_COURS → RECU.
 * Crée les MouvementStock et met à jour le StockSite.
 * Notifie le RPV, la Logistique et le Comptable.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id: idStr } = await params;
    const id = Number(idStr);

    const reception = await prisma.receptionApprovisionnement.findUnique({
      where:   { id },
      include: { lignes: { include: { produit: { select: { id: true, nom: true } } } } },
    });
    if (!reception) return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });

    const body   = await req.json();
    const action = body.action as string;

    if (action !== "valider")
      return NextResponse.json({ error: "Action invalide. Seule 'valider' est acceptée." }, { status: 400 });

    if (reception.statut !== "EN_COURS")
      return NextResponse.json({ error: "Seule une réception EN_COURS peut être validée par le Magasinier" }, { status: 400 });

    const lignesRecues: { ligneId: number; quantiteRecue: number }[] = body.lignes ?? [];
    // Si aucune ligne fournie, on utilise les quantités attendues
    if (!lignesRecues.length) {
      for (const l of reception.lignes) {
        lignesRecues.push({ ligneId: l.id, quantiteRecue: l.quantiteAttendue });
      }
    }

    const operateur = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const updated = await prisma.$transaction(async (tx) => {
      for (const lr of lignesRecues) {
        const ligne = reception.lignes.find((x) => x.id === lr.ligneId);
        if (!ligne) continue;

        await tx.ligneReceptionAppro.update({
          where: { id: lr.ligneId },
          data:  { quantiteRecue: lr.quantiteRecue },
        });

        // Incrémenter le StockSite du PDV réceptionnaire
        await tx.stockSite.upsert({
          where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: reception.pointDeVenteId } },
          update: { quantite: { increment: lr.quantiteRecue } },
          create: { produitId: ligne.produitId, pointDeVenteId: reception.pointDeVenteId, quantite: lr.quantiteRecue },
        });

        await tx.mouvementStock.create({
          data: {
            produitId:      ligne.produitId,
            pointDeVenteId: reception.pointDeVenteId,
            type:           "ENTREE",
            quantite:       lr.quantiteRecue,
            motif:          `Réception appro ${reception.reference} — validé par ${operateur} (Magasinier)`,
            reference:      `MAG-LIV-${randomUUID()}`,
          },
        });
      }

      const validated = await tx.receptionApprovisionnement.update({
        where:   { id },
        data:    { statut: "RECU", dateReception: new Date(), valideParId: parseInt(session.user.id) },
        include: { lignes: { include: { produit: { select: { id: true, nom: true } } } } },
      });

      await auditLog(tx, parseInt(session.user.id), "LIVRAISON_VALIDEE_MAGASINIER", "ReceptionApprovisionnement", id);

      const produitsStr = lignesRecues
        .map((lr) => {
          const l = reception.lignes.find((x) => x.id === lr.ligneId);
          return l ? `${lr.quantiteRecue}× ${l.produit.nom}` : null;
        })
        .filter(Boolean)
        .join(", ");

      await notifyRoles(
        tx,
        ["RESPONSABLE_POINT_DE_VENTE", "AGENT_LOGISTIQUE_APPROVISIONNEMENT", "COMPTABLE"],
        {
          titre:    `Réception validée — ${reception.reference}`,
          message:  `${operateur} (Magasinier) a validé la réception ${reception.reference}. ${lignesRecues.length} ligne(s) : ${produitsStr}. Stock mis à jour.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/responsablesPointDeVente`,
        }
      );

      return validated;
    });

    return NextResponse.json({
      success: true,
      message: `Réception validée — ${lignesRecues.length} ligne(s) traitée(s), stock mis à jour`,
      data: {
        ...updated,
        datePrevisionnelle: updated.datePrevisionnelle.toISOString(),
        dateReception:      updated.dateReception?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("PATCH /api/magasinier/livraisons-rpv/[id] error:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}
