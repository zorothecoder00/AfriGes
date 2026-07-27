import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getSession } from "../../../route";

type Ctx = { params: Promise<{ id: string; litigeId: string }> };

/**
 * PATCH /api/logistique/fournisseurs/[id]/litiges/[litigeId]
 * Body: { action: "RESOUDRE" | "REJETER" }
 * Clôture un litige — pèse sur le score de disponibilité/litiges du fournisseur.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { litigeId } = await params;
    const existing = await prisma.litigeFournisseur.findUnique({ where: { id: Number(litigeId) } });
    if (!existing) return NextResponse.json({ error: "Litige introuvable" }, { status: 404 });
    if (existing.statut !== "OUVERT") {
      return NextResponse.json({ error: "Ce litige est déjà clôturé" }, { status: 422 });
    }

    const { action } = await req.json() as { action: "RESOUDRE" | "REJETER" };
    const statut = action === "RESOUDRE" ? "RESOLU" : action === "REJETER" ? "REJETE" : null;
    if (!statut) return NextResponse.json({ error: "Action inconnue" }, { status: 400 });

    const updated = await prisma.$transaction(async (tx) => {
      const l = await tx.litigeFournisseur.update({
        where: { id: Number(litigeId) },
        data: { statut, resoluParId: parseInt(session.user.id), dateResolution: new Date() },
      });
      await auditLog(tx, parseInt(session.user.id), `LITIGE_FOURNISSEUR_${statut}`, "LitigeFournisseur", l.id);
      return l;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /logistique/fournisseurs/[id]/litiges/[litigeId]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
