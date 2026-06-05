import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { PrioriteNotification, TypeMouvement, TypeSortieStock } from "@prisma/client";

type Ctx = { params: Promise<{ id: string; ligneId: string }> };

/**
 * PATCH /api/magasinier/credits/[id]/lignes/[ligneId]
 * Permet au magasinier de confirmer la livraison physique d'une ligne de crédit.
 * Action autorisée : LIVRE uniquement (le magasinier confirme la sortie physique).
 * Body: { notes?: string }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, ligneId } = await params;
    const creditId = Number(id);
    const ligneIdN = Number(ligneId);
    if (isNaN(creditId) || isNaN(ligneIdN)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);
    const body   = await req.json() as { notes?: string };

    const updated = await prisma.$transaction(async (tx) => {
      const ligne = await tx.ligneCreditClient.findUnique({
        where: { id: ligneIdN },
        include: {
          credit: {
            select: {
              id: true,
              reference: true,
              pointDeVenteId: true,
              creeParId: true,
              client: { select: { nom: true, prenom: true } },
            },
          },
        },
      });
      if (!ligne)                          throw new Error("LIGNE_INTROUVABLE");
      if (ligne.creditId !== creditId)     throw new Error("LIGNE_INTROUVABLE");
      if (ligne.statut !== "EN_ATTENTE")   throw new Error("LIGNE_NON_EN_ATTENTE");

      // Vérifier que le crédit appartient au PDV du magasinier (si non-admin)
      const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
      if (!isAdmin && ligne.credit.pointDeVenteId) {
        const aff = await tx.gestionnaireAffectation.findFirst({
          where: { userId, actif: true },
          select: { pointDeVenteId: true },
        });
        if (!aff || aff.pointDeVenteId !== ligne.credit.pointDeVenteId) {
          throw new Error("CREDIT_HORS_PERIMETRE");
        }
      }

      const result = await tx.ligneCreditClient.update({
        where: { id: ligneIdN },
        data: {
          statut:         "LIVRE",
          notes:          body.notes ?? ligne.notes,
          traiteParId:    userId,
          dateTraitement: new Date(),
        },
      });

      await auditLog(tx, userId, "LIGNE_CREDIT_LIVRE_MAGASINIER", "LigneCreditClient", ligneIdN);

      // ── Décrémenter le stock physique à la livraison ──────────────────────
      if (ligne.produitId && ligne.credit.pointDeVenteId) {
        await tx.stockSite.updateMany({
          where: {
            produitId:      ligne.produitId,
            pointDeVenteId: ligne.credit.pointDeVenteId,
          },
          data: {
            quantite:         { decrement: ligne.quantite },
            quantiteReservee: { decrement: ligne.quantite },
          },
        });
        const dateStr = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
        await tx.mouvementStock.create({
          data: {
            produitId:      ligne.produitId,
            pointDeVenteId: ligne.credit.pointDeVenteId,
            type:           TypeMouvement.SORTIE,
            typeSortie:     TypeSortieStock.LIVRAISON_CLIENT,
            quantite:       ligne.quantite,
            prixUnitaire:   ligne.prixUnitaire,
            motif:          `Livraison crédit — ${ligne.credit.reference}`,
            reference:      `MVT-LIV-${creditId}-L${ligneIdN}-${dateStr}`,
            operateurId:    userId,
          },
        });
      }

      // Notifier le RVC et les admins que la livraison est confirmée
      const nomClient = ligne.credit.client
        ? `${ligne.credit.client.prenom} ${ligne.credit.client.nom}`
        : "client";

      await notifyRoles(tx, ["RESPONSABLE_VENTE_CREDIT"], {
        titre:    `Livraison confirmée — ${ligne.credit.reference}`,
        message:  `Le magasinier a confirmé la livraison de "${ligne.produitNom}" ×${ligne.quantite} pour ${nomClient} (crédit ${ligne.credit.reference}).`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/user/responsablesVenteCredit/credits`,
      });

      // Notifier l'agent terrain créateur du crédit
      if (ligne.credit.creeParId && ligne.credit.creeParId !== userId) {
        await tx.notification.create({
          data: {
            userId:    ligne.credit.creeParId,
            titre:     `Livraison effectuée — ${ligne.credit.reference}`,
            message:   `"${ligne.produitNom}" ×${ligne.quantite} a été livré à ${nomClient} (crédit ${ligne.credit.reference}).`,
            priorite:  PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/user/agentsTerrain/credits`,
          },
        });
      }

      return result;
    });

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        LIGNE_INTROUVABLE:      ["Ligne introuvable", 404],
        LIGNE_NON_EN_ATTENTE:   ["Cette ligne n'est pas en attente de livraison", 409],
        CREDIT_HORS_PERIMETRE:  ["Ce crédit n'appartient pas à votre point de vente", 403],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ error: msg }, { status });
      }
    }
    console.error("PATCH /api/magasinier/credits/[id]/lignes/[ligneId]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
