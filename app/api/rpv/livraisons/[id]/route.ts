import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { notifyRoles, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/rpv/livraisons/[id] — Détail complet d'une réception */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id: idStr } = await params;
    const reception = await prisma.receptionApprovisionnement.findUnique({
      where:   { id: Number(idStr) },
      include: { lignes: { include: { produit: { select: { id: true, nom: true, prixUnitaire: true } } } } },
    });
    if (!reception) return NextResponse.json({ message: "Livraison introuvable" }, { status: 404 });

    return NextResponse.json({
      success: true,
      data: {
        ...reception,
        datePrevisionnelle: reception.datePrevisionnelle.toISOString(),
        dateReception:      reception.dateReception?.toISOString() ?? null,
        createdAt:          reception.createdAt.toISOString(),
        updatedAt:          reception.updatedAt.toISOString(),
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
    const reception = await prisma.receptionApprovisionnement.findUnique({
      where: { id },
    });
    if (!reception) return NextResponse.json({ message: "Livraison introuvable" }, { status: 404 });

    const body   = await req.json();
    const action = body.action as string;

    // ── Annuler (uniquement BROUILLON ou EN_COURS) ─────────────────────────
    if (action === "annuler") {
      if (!["BROUILLON", "EN_COURS"].includes(reception.statut))
        return NextResponse.json({ message: "Seule une livraison BROUILLON ou EN_COURS peut être annulée par le RPV" }, { status: 400 });

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.receptionApprovisionnement.update({ where: { id }, data: { statut: "ANNULE" } });

        await auditLog(tx, parseInt(session.user.id), "LIVRAISON_ANNULEE_RPV", "ReceptionApprovisionnement", id);

        await notifyRoles(
          tx,
          ["MAGAZINIER", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"],
          {
            titre:    `Livraison annulée — ${reception.reference}`,
            message:  `${session.user.name ?? "RPV"} a annulé la livraison ${reception.reference} (${reception.type === "FOURNISSEUR" ? "réception fournisseur" : "réception interne"}).`,
            priorite: PrioriteNotification.HAUTE,
            actionUrl: `/dashboard/user/logistiquesApprovisionnements`,
          }
        );
        return u;
      });
      return NextResponse.json({ success: true, message: "Livraison annulée", data: { ...updated, datePrevisionnelle: updated.datePrevisionnelle.toISOString() } });
    }

    return NextResponse.json({ message: "Action non autorisée pour le RPV. Utilisez 'annuler' (BROUILLON/EN_COURS seulement). La validation revient à la Logistique/Magasinier." }, { status: 403 });
  } catch (error) {
    console.error("PATCH /api/rpv/livraisons/[id] error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
