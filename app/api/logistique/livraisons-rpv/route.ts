import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification, StatutReceptionAppro } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/logistique/livraisons-rpv
 * Liste les réceptions d'approvisionnement en BROUILLON ou EN_COURS.
 */
export async function GET(req: Request) {
  try {
    const session = await getLogistiqueSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut") ?? "";

    const where: Prisma.ReceptionApprovisionnementWhereInput = statut
      ? { statut: statut as StatutReceptionAppro }
      : { statut: { in: ["BROUILLON", "EN_COURS"] } };

    const receptions = await prisma.receptionApprovisionnement.findMany({
      where,
      orderBy: { datePrevisionnelle: "asc" },
      include: {
        lignes: {
          include: { produit: { select: { id: true, nom: true, prixUnitaire: true } } },
        },
      },
    });

    const [brouillon, enCours] = await Promise.all([
      prisma.receptionApprovisionnement.count({ where: { statut: "BROUILLON" } }),
      prisma.receptionApprovisionnement.count({ where: { statut: "EN_COURS"  } }),
    ]);

    return NextResponse.json({
      success: true,
      data: receptions.map((r) => ({
        ...r,
        datePrevisionnelle: r.datePrevisionnelle.toISOString(),
        dateReception:      r.dateReception?.toISOString() ?? null,
        createdAt:          r.createdAt.toISOString(),
        updatedAt:          r.updatedAt.toISOString(),
      })),
      stats: { brouillon, enCours },
    });
  } catch (error) {
    console.error("GET /api/logistique/livraisons-rpv error:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/logistique/livraisons-rpv
 * Body : { id: number, action: "demarrer" }
 * Passe la réception de BROUILLON → EN_COURS.
 * Notifie le RPV et le Magasinier.
 */
export async function PATCH(req: Request) {
  try {
    const session = await getLogistiqueSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { id, action } = body as { id: number; action: string };

    if (!id || action !== "demarrer")
      return NextResponse.json({ error: "Paramètres invalides (id + action:'demarrer' requis)" }, { status: 400 });

    const reception = await prisma.receptionApprovisionnement.findUnique({
      where:   { id: Number(id) },
      include: { lignes: { include: { produit: { select: { id: true, nom: true } } } } },
    });
    if (!reception) return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
    if (reception.statut !== "BROUILLON")
      return NextResponse.json({ error: "Seule une réception BROUILLON peut être démarrée" }, { status: 400 });

    const operateur = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.receptionApprovisionnement.update({ where: { id: Number(id) }, data: { statut: "EN_COURS" } });

      await auditLog(tx, parseInt(session.user.id), "LIVRAISON_DEMARREE_LOGISTIQUE", "ReceptionApprovisionnement", Number(id));

      const lignesStr = reception.lignes.map((l) => `${l.quantiteAttendue}× ${l.produit.nom}`).join(", ");

      await notifyRoles(
        tx,
        ["RESPONSABLE_POINT_DE_VENTE", "MAGAZINIER"],
        {
          titre:    `Livraison démarrée — ${reception.reference}`,
          message:  `${operateur} (Logistique) a démarré la réception ${reception.reference} (${reception.type === "FOURNISSEUR" ? "fournisseur" : "interne"}). Produits : ${lignesStr}. Le Magasinier doit valider à réception.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/magasiniers`,
        }
      );
      return u;
    });

    return NextResponse.json({
      success: true,
      message: "Réception démarrée — en attente de validation par le Magasinier",
      data: { ...updated, datePrevisionnelle: updated.datePrevisionnelle.toISOString() },
    });
  } catch (error) {
    console.error("PATCH /api/logistique/livraisons-rpv error:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}
