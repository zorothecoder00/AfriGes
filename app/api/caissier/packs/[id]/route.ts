import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";
import { auditLog, notifyAdmins } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Vérifie que la souscription appartient au périmètre PDV du caissier.
 * Retourne la souscription (avec les relations nécessaires au contrôle) ou null si hors périmètre.
 */
async function chargerSouscriptionScopee(souscriptionId: number, pdvId: number | null) {
  const souscription = await prisma.souscriptionPack.findUnique({
    where: { id: souscriptionId },
    include: {
      pack: { select: { nom: true } },
      client: { select: { pointDeVenteId: true } },
      user: {
        select: {
          affectationsPDV: { where: { actif: true }, select: { pointDeVenteId: true } },
        },
      },
      receptions: { select: { statut: true } },
    },
  });

  if (!souscription) return { souscription: null, horsPerimetre: false };

  if (pdvId) {
    const clientPdv = souscription.client?.pointDeVenteId;
    const userPdv = souscription.user?.affectationsPDV?.some((a) => a.pointDeVenteId === pdvId);
    if (clientPdv !== pdvId && !userPdv) {
      return { souscription, horsPerimetre: true };
    }
  }

  return { souscription, horsPerimetre: false };
}

/**
 * GET — Détail complet d'une souscription (versements, échéances, réceptions).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    const { id } = await params;

    const souscription = await prisma.souscriptionPack.findUnique({
      where: { id: parseInt(id) },
      include: {
        pack: true,
        user: {
          select: {
            id: true, nom: true, prenom: true, telephone: true,
            affectationsPDV: { where: { actif: true }, select: { pointDeVenteId: true } },
          },
        },
        client: { select: { id: true, nom: true, prenom: true, telephone: true, pointDeVenteId: true } },
        versements: { orderBy: { datePaiement: "desc" } },
        echeances: { orderBy: { numero: "asc" } },
        receptions: {
          include: {
            lignes: {
              include: { produit: { select: { nom: true, prixUnitaire: true } } },
            },
          },
        },
      },
    });

    if (!souscription) {
      return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    }

    // Vérifier que la souscription appartient au PDV du caissier
    if (!isAdmin && pdvId) {
      const clientPdv = souscription.client?.pointDeVenteId;
      const userPdv   = souscription.user?.affectationsPDV?.some(a => a.pointDeVenteId === pdvId);
      if (clientPdv !== pdvId && !userPdv) {
        return NextResponse.json({ error: "Souscription hors de votre périmètre" }, { status: 403 });
      }
    }

    return NextResponse.json(souscription);
  } catch (error) {
    console.error("GET /api/caissier/packs/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH — Annule une souscription (statut → ANNULE) pour permettre à la
 * caissière de recommencer une saisie erronée. Ne supprime aucune donnée :
 * les versements déjà encaissés restent visibles pour l'audit et la caisse.
 * Body: { action: "ANNULER" }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    const { id } = await params;
    const souscriptionId = parseInt(id);
    if (isNaN(souscriptionId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { action } = body as { action?: string };
    if (action !== "ANNULER") {
      return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    }

    const { souscription, horsPerimetre } = await chargerSouscriptionScopee(souscriptionId, pdvId);
    if (!souscription) return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    if (horsPerimetre) return NextResponse.json({ error: "Souscription hors de votre périmètre" }, { status: 403 });

    if (souscription.statut === "ANNULE") {
      return NextResponse.json({ error: "Souscription déjà annulée" }, { status: 400 });
    }
    // Une souscription soldée (COMPLETE) peut aussi être annulée : la caissière
    // doit pouvoir corriger une vieille erreur de saisie découverte plus tard,
    // même après clôture du pack, pour que les totaux ne restent pas faussés.

    const caissierNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.souscriptionPack.update({
        where: { id: souscriptionId },
        data: { statut: "ANNULE", dateCloture: new Date() },
      });

      await notifyAdmins(tx, {
        titre: `Souscription annulée — ${souscription.pack.nom}`,
        message: `${caissierNom} a annulé la souscription #${souscriptionId} (${souscription.pack.nom}) — erreur de saisie.`,
        priorite: "HAUTE",
        actionUrl: "/dashboard/admin/packs",
      });
      await auditLog(tx, userId, "SOUSCRIPTION_PACK_ANNULEE", "SouscriptionPack", souscriptionId);

      return s;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PATCH /api/caissier/packs/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE — Supprime définitivement une souscription erronée (créée par erreur,
 * mauvais client/pack/montant). Bloquée si un produit a déjà été livré dessus,
 * ou si un versement est rattaché à une collecte terrain (intégrité référentielle).
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    const { id } = await params;
    const souscriptionId = parseInt(id);
    if (isNaN(souscriptionId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const { souscription, horsPerimetre } = await chargerSouscriptionScopee(souscriptionId, pdvId);
    if (!souscription) return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    if (horsPerimetre) return NextResponse.json({ error: "Souscription hors de votre périmètre" }, { status: 403 });

    if (souscription.receptions.some((r) => r.statut === "LIVREE")) {
      return NextResponse.json(
        { error: "Un produit a déjà été livré sur cette souscription : suppression impossible. Utilisez l'annulation, ou contactez un administrateur." },
        { status: 400 }
      );
    }

    const collecteLiee = await prisma.ligneCollecte.count({
      where: { versementPack: { souscriptionId } },
    });
    if (collecteLiee > 0) {
      return NextResponse.json(
        { error: "Un versement de cette souscription est lié à une collecte terrain : suppression impossible. Utilisez l'annulation, ou contactez un administrateur." },
        { status: 400 }
      );
    }

    const caissierNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    await prisma.$transaction(async (tx) => {
      await tx.receptionProduitPack.deleteMany({ where: { souscriptionId } });
      await tx.echeancePack.deleteMany({ where: { souscriptionId } });
      await tx.versementPack.deleteMany({ where: { souscriptionId } });
      await tx.souscriptionPack.delete({ where: { id: souscriptionId } });

      await notifyAdmins(tx, {
        titre: `Souscription supprimée — #${souscriptionId}`,
        message: `${caissierNom} a supprimé la souscription #${souscriptionId} (${souscription.pack.nom}) — erreur de saisie.`,
        priorite: "HAUTE",
        actionUrl: "/dashboard/admin/packs",
      });
      await auditLog(tx, userId, "SOUSCRIPTION_PACK_SUPPRIMEE", "SouscriptionPack", souscriptionId);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/caissier/packs/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
