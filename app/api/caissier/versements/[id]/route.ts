import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId, souscriptionPdvWhere } from "@/lib/authCaissier";
import { recalculerSouscriptionApresVersements } from "@/lib/versementPack";
import { auditLog, notifyAdmins } from "@/lib/notifications";

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

      await recalculerSouscriptionApresVersements(tx, souscription.id, newDate ?? versement.datePaiement);

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

/**
 * DELETE /api/caissier/versements/[id]
 * Supprime un versement pack saisi par erreur (ex. doublon après suppression
 * puis recréation d'une souscription). Recalcule montantVerse/montantRestant/
 * statut/échéances de la souscription à partir des versements restants.
 * Bloqué si un produit a déjà été livré sur la souscription (incohérence
 * client livré mais plus versé), ou si le versement est lié à une collecte
 * terrain (intégrité référentielle).
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const versementId = parseInt(id);
    if (isNaN(versementId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId = isAdmin ? null : await getCaissierPdvId(userId);

    if (pdvId) {
      const allowed = await prisma.versementPack.findFirst({
        where: { id: versementId, souscription: souscriptionPdvWhere(pdvId) },
      });
      if (!allowed) {
        return NextResponse.json({ error: "Accès refusé à ce versement" }, { status: 403 });
      }
    }

    const versement = await prisma.versementPack.findUnique({
      where: { id: versementId },
      include: {
        souscription: {
          include: {
            pack: { select: { nom: true } },
            receptions: { select: { statut: true } },
          },
        },
        ligneCollecte: { select: { id: true } },
      },
    });
    if (!versement) return NextResponse.json({ error: "Versement introuvable" }, { status: 404 });

    if (versement.souscription.receptions.some((r) => r.statut === "LIVREE")) {
      return NextResponse.json(
        { error: "Un produit a déjà été livré sur cette souscription : suppression du versement impossible. Contactez un administrateur." },
        { status: 400 }
      );
    }
    if (versement.ligneCollecte) {
      return NextResponse.json(
        { error: "Ce versement est lié à une collecte terrain : suppression impossible. Contactez un administrateur." },
        { status: 400 }
      );
    }

    const caissierNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();
    const souscriptionId = versement.souscriptionId;

    await prisma.$transaction(async (tx) => {
      await tx.versementPack.delete({ where: { id: versementId } });
      await recalculerSouscriptionApresVersements(tx, souscriptionId);

      await notifyAdmins(tx, {
        titre: `Versement supprimé — ${versement.souscription.pack.nom}`,
        message: `${caissierNom} a supprimé un versement de ${Number(versement.montant).toLocaleString("fr-FR")} FCFA sur la souscription #${souscriptionId} (${versement.souscription.pack.nom}) — erreur de saisie.`,
        priorite: "HAUTE",
        actionUrl: "/dashboard/admin/packs",
      });
      await auditLog(tx, userId, "VERSEMENT_PACK_SUPPRIME", "VersementPack", versementId);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/caissier/versements/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
