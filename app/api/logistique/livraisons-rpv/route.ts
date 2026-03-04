import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/logistique/livraisons-rpv
 * Liste les livraisons RPV en attente de démarrage (EN_ATTENTE)
 * ainsi que celles en cours (EN_COURS), pour suivi.
 */
export async function GET(req: Request) {
  try {
    const session = await getLogistiqueSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut") ?? "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) {
      where.statut = statut;
    } else {
      where.statut = { in: ["EN_ATTENTE", "EN_COURS"] };
    }

    const livraisons = await prisma.livraison.findMany({
      where,
      orderBy: { datePrevisionnelle: "asc" },
      include: {
        lignes: {
          include: { produit: { select: { id: true, nom: true, stock: true, prixUnitaire: true } } },
        },
      },
    });

    const [enAttente, enCours] = await Promise.all([
      prisma.livraison.count({ where: { statut: "EN_ATTENTE" } }),
      prisma.livraison.count({ where: { statut: "EN_COURS"   } }),
    ]);

    return NextResponse.json({
      success: true,
      data: livraisons.map((l) => ({
        ...l,
        datePrevisionnelle: l.datePrevisionnelle.toISOString(),
        dateLivraison:      l.dateLivraison?.toISOString() ?? null,
        createdAt:          l.createdAt.toISOString(),
        updatedAt:          l.updatedAt.toISOString(),
      })),
      stats: { enAttente, enCours },
    });
  } catch (error) {
    console.error("GET /api/logistique/livraisons-rpv error:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/logistique/livraisons-rpv
 * Body : { id: number, action: "demarrer" }
 * Passe la livraison de EN_ATTENTE → EN_COURS.
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

    const livraison = await prisma.livraison.findUnique({
      where:   { id: Number(id) },
      include: { lignes: { include: { produit: { select: { id: true, nom: true } } } } },
    });
    if (!livraison) return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
    if (livraison.statut !== "EN_ATTENTE")
      return NextResponse.json({ error: "Seule une livraison EN_ATTENTE peut être démarrée" }, { status: 400 });

    const operateur = `${session.user.prenom} ${session.user.nom}`;

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.livraison.update({ where: { id: Number(id) }, data: { statut: "EN_COURS" } });

      await auditLog(tx, parseInt(session.user.id), "LIVRAISON_DEMARREE_LOGISTIQUE", "Livraison", Number(id));

      const lignesStr = livraison.lignes.map((l) => `${l.quantitePrevue}× ${l.produit.nom}`).join(", ");

      await notifyRoles(
        tx,
        ["RESPONSABLE_POINT_DE_VENTE", "MAGAZINIER"],
        {
          titre:    `Livraison démarrée — ${livraison.reference}`,
          message:  `${operateur} (Logistique) a démarré la livraison ${livraison.reference} (${livraison.type === "RECEPTION" ? "réception" : "expédition"}). Produits : ${lignesStr}. Le Magasinier doit valider à réception.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/magasiniers`,
        }
      );
      return u;
    });

    return NextResponse.json({
      success: true,
      message: "Livraison démarrée — en attente de réception par le Magasinier",
      data: { ...updated, datePrevisionnelle: updated.datePrevisionnelle.toISOString() },
    });
  } catch (error) {
    console.error("PATCH /api/logistique/livraisons-rpv error:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}
