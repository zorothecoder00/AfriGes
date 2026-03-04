import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/rpv/receptions-packs/[id]
 * Annule une réception de produit pack avec justification obligatoire.
 * Body: { action: "annuler", justification: string }
 * Log horodaté créé dans AuditLog.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const receptionId = parseInt(id);
    const { action, justification } = await req.json();

    if (action !== "annuler") {
      return NextResponse.json({ error: "Action invalide. Seule 'annuler' est supportée." }, { status: 400 });
    }
    if (!justification || justification.trim().length < 5) {
      return NextResponse.json({ error: "Justification obligatoire (5 caractères minimum)" }, { status: 400 });
    }

    const reception = await prisma.receptionProduitPack.findUnique({
      where:   { id: receptionId },
      include: { souscription: { include: { pack: true } }, lignes: true },
    });

    if (!reception) return NextResponse.json({ error: "Réception introuvable" }, { status: 404 });
    if (reception.statut === "ANNULEE") {
      return NextResponse.json({ error: "Cette réception est déjà annulée" }, { status: 409 });
    }
    if (reception.statut === "LIVREE") {
      return NextResponse.json({ error: "Impossible d'annuler une livraison déjà effectuée" }, { status: 409 });
    }

    const rpvNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();
    const horodatage = new Date().toISOString();

    const updated = await prisma.$transaction(async (tx) => {
      const rec = await tx.receptionProduitPack.update({
        where: { id: receptionId },
        data: {
          statut: "ANNULEE",
          notes:  `[ANNULÉE le ${horodatage} par ${rpvNom}] Justification : ${justification.trim()}${reception.notes ? `\n\nNotes originales : ${reception.notes}` : ""}`,
        },
      });

      await notifyAdmins(tx, {
        titre:    `Livraison pack annulée — ${reception.souscription.pack.nom}`,
        message:  `La livraison #${receptionId} a été annulée par ${rpvNom}. Justification : ${justification.trim()}`,
        priorite: "HAUTE",
        actionUrl: "/dashboard/user/responsablesPointDeVente",
      });

      // Audit log horodaté avec justification
      await auditLog(
        tx,
        parseInt(session.user.id),
        `ANNULATION_LIVRAISON_PACK | Justification: ${justification.trim()} | Horodatage: ${horodatage}`,
        "ReceptionProduitPack",
        receptionId
      );

      return rec;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PATCH /api/rpv/receptions-packs/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
