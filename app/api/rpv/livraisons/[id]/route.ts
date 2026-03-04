import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { notifyRoles, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/rpv/livraisons/[id] — Détail complet d'une livraison */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id: idStr } = await params;
    const livraison = await prisma.livraison.findUnique({
      where:   { id: Number(idStr) },
      include: { lignes: { include: { produit: { select: { id: true, nom: true, stock: true, prixUnitaire: true } } } } },
    });
    if (!livraison) return NextResponse.json({ message: "Livraison introuvable" }, { status: 404 });

    return NextResponse.json({
      success: true,
      data: {
        ...livraison,
        datePrevisionnelle: livraison.datePrevisionnelle.toISOString(),
        dateLivraison:      livraison.dateLivraison?.toISOString() ?? null,
        createdAt:          livraison.createdAt.toISOString(),
        updatedAt:          livraison.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/rpv/livraisons/[id] error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/rpv/livraisons/[id]
 *
 * Seule action RPV autorisée :
 *  - { action: "annuler" }  EN_ATTENTE → ANNULEE
 *
 * Les actions demarrer (EN_ATTENTE→EN_COURS) et valider (EN_COURS→LIVREE)
 * sont réservées respectivement à l'Agent Logistique et au Magasinier.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id: idStr } = await params;
    const id = Number(idStr);
    const livraison = await prisma.livraison.findUnique({
      where:   { id },
      include: { lignes: { include: { produit: true } } },
    });
    if (!livraison) return NextResponse.json({ message: "Livraison introuvable" }, { status: 404 });

    const body   = await req.json();
    const action = body.action as string;

    // ── Annuler (uniquement EN_ATTENTE) ───────────────────────────────────
    if (action === "annuler") {
      if (livraison.statut !== "EN_ATTENTE")
        return NextResponse.json({ message: "Seule une livraison EN_ATTENTE peut être annulée par le RPV" }, { status: 400 });

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.livraison.update({ where: { id }, data: { statut: "ANNULEE" } });

        await auditLog(tx, parseInt(session.user.id), "LIVRAISON_ANNULEE_RPV", "Livraison", id);

        await notifyRoles(
          tx,
          ["MAGAZINIER", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"],
          {
            titre:    `Livraison annulée — ${livraison.reference}`,
            message:  `${session.user.name ?? "RPV"} a annulé la livraison ${livraison.reference} (${livraison.type === "RECEPTION" ? "réception" : "expédition"}).`,
            priorite: PrioriteNotification.HAUTE,
            actionUrl: `/dashboard/user/logistiquesApprovisionnements`,
          }
        );
        return u;
      });
      return NextResponse.json({ success: true, message: "Livraison annulée", data: { ...updated, datePrevisionnelle: updated.datePrevisionnelle.toISOString() } });
    }

    return NextResponse.json({ message: "Action non autorisée pour le RPV. Utilisez 'annuler' (EN_ATTENTE seulement). Le démarrage revient à la Logistique, la validation au Magasinier." }, { status: 403 });
  } catch (error) {
    console.error("PATCH /api/rpv/livraisons/[id] error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
