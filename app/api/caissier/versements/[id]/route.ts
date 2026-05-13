import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId, souscriptionPdvWhere } from "@/lib/authCaissier";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/caissier/versements/[id]
 * Modifie la datePaiement et/ou le montant d'un versement existant.
 * Body: { datePaiement?: string (ISO date), montant?: number }
 * - Recalcule montantVerse / montantRestant / statut de la souscription
 * - Remet à jour les échéances en conséquence
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const versementId = parseInt(id);
    if (isNaN(versementId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { datePaiement, montant, notes } = body as { datePaiement?: string; montant?: number; notes?: string | null };

    if (!datePaiement && montant === undefined && notes === undefined) {
      return NextResponse.json({ error: "Aucun champ à modifier" }, { status: 400 });
    }

    // Validation date
    let newDate: Date | undefined;
    if (datePaiement) {
      newDate = new Date(datePaiement);
      if (isNaN(newDate.getTime())) {
        return NextResponse.json({ error: "Date invalide" }, { status: 400 });
      }
      if (newDate > new Date()) {
        return NextResponse.json({ error: "La date ne peut pas être dans le futur" }, { status: 400 });
      }
    }

    // Validation montant
    if (montant !== undefined && (isNaN(montant) || montant <= 0)) {
      return NextResponse.json({ error: "Le montant doit être supérieur à 0" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId = isAdmin ? null : await getCaissierPdvId(userId);

    // Vérification PDV
    if (pdvId) {
      const allowed = await prisma.versementPack.findFirst({
        where: { id: versementId, souscription: souscriptionPdvWhere(pdvId) },
      });
      if (!allowed) {
        return NextResponse.json({ error: "Accès refusé à ce versement" }, { status: 403 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const versement = await tx.versementPack.findUnique({
        where: { id: versementId },
        include: {
          souscription: {
            include: { pack: true },
          },
        },
      });

      if (!versement) throw new Error("Versement introuvable");

      const souscription = versement.souscription;

      // Construire les données de mise à jour du versement
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {};
      if (newDate) updateData.datePaiement = newDate;
      if (montant !== undefined) updateData.montant = montant;
      if (notes !== undefined) updateData.notes = notes ?? null;

      await tx.versementPack.update({ where: { id: versementId }, data: updateData });

      // Si le montant ne change pas, pas besoin de recalculer la souscription/échéances
      if (montant === undefined) {
        return { id: versementId };
      }

      // Recalculer montantVerse en sommant TOUS les versements de cette souscription
      const agg = await tx.versementPack.aggregate({
        where: { souscriptionId: souscription.id },
        _sum: { montant: true },
      });
      const nouveauMontantVerse = Number(agg._sum.montant ?? 0);
      const montantTotal = Number(souscription.montantTotal);
      const nouveauMontantRestant = montantTotal - nouveauMontantVerse;
      const estSolde = nouveauMontantRestant <= 0;

      if (nouveauMontantVerse > montantTotal) {
        throw new Error(
          `Le montant corrigé dépasse le montant total de la souscription (${montantTotal.toLocaleString("fr-FR")} FCFA)`
        );
      }

      // Calculer le nouveau statut
      let nouveauStatut: string;
      if (estSolde) {
        nouveauStatut = "COMPLETE";
      } else if (souscription.pack.type === "REVENDEUR" && souscription.formuleRevendeur === "FORMULE_1") {
        const seuil50 = montantTotal * 0.5;
        nouveauStatut = nouveauMontantVerse >= seuil50 ? "ACTIF" : "EN_ATTENTE";
      } else if (souscription.pack.type === "URGENCE" && souscription.pack.acomptePercent) {
        const seuilAcompte = (montantTotal * Number(souscription.pack.acomptePercent)) / 100;
        nouveauStatut = nouveauMontantVerse >= seuilAcompte ? "ACTIF" : "EN_ATTENTE";
      } else {
        nouveauStatut = nouveauMontantVerse > 0 ? "ACTIF" : "EN_ATTENTE";
      }

      await tx.souscriptionPack.update({
        where: { id: souscription.id },
        data: {
          montantVerse: nouveauMontantVerse,
          montantRestant: estSolde ? 0 : nouveauMontantRestant,
          statut: nouveauStatut as never,
          dateCloture: estSolde ? (souscription.dateCloture ?? new Date()) : null,
        },
      });

      // Recalculer les échéances ─────────────────────────────────────────────
      // 1. Reset toutes les échéances de la souscription
      const now = new Date();
      const toutesEcheances = await tx.echeancePack.findMany({
        where: { souscriptionId: souscription.id },
        orderBy: { numero: "asc" },
      });

      // Remettre toutes à EN_ATTENTE ou EN_RETARD selon leur date
      for (const ec of toutesEcheances) {
        await tx.echeancePack.update({
          where: { id: ec.id },
          data: {
            statut: new Date(ec.datePrevue) < now ? "EN_RETARD" : "EN_ATTENTE",
            datePaiement: null,
          },
        });
      }

      // 2. Re-marquer payées en ordre croissant selon le budget total versé
      if (estSolde) {
        await tx.echeancePack.updateMany({
          where: { souscriptionId: souscription.id },
          data: { statut: "PAYE", datePaiement: newDate ?? versement.datePaiement },
        });
      } else {
        const idsAPayer: number[] = [];
        let budget = nouveauMontantVerse;
        for (const ec of toutesEcheances) {
          if (budget >= Number(ec.montant) - 0.01) {
            idsAPayer.push(ec.id);
            budget -= Number(ec.montant);
          } else break;
        }
        // Si le budget couvre partiellement mais pas intégralement la première,
        // marquer quand même la première (paiement partiel d'une échéance)
        if (idsAPayer.length === 0 && toutesEcheances.length > 0 && nouveauMontantVerse > 0) {
          idsAPayer.push(toutesEcheances[0].id);
        }
        if (idsAPayer.length > 0) {
          await tx.echeancePack.updateMany({
            where: { id: { in: idsAPayer } },
            data: { statut: "PAYE", datePaiement: newDate ?? versement.datePaiement },
          });
        }
      }

      return { id: versementId };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    console.error("PATCH /api/caissier/versements/[id]:", error);
    if (msg.includes("dépasse le montant total")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (msg === "Versement introuvable") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
