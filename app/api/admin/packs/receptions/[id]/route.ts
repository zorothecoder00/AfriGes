import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/packs/receptions/[id]
 *
 * Annule une livraison planifiée (PLANIFIEE → ANNULEE).
 * Une livraison déjà LIVREE ne peut pas être annulée (stock déjà décrémenté).
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const receptionId = parseInt(id);
    const adminNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const rec = await prisma.receptionProduitPack.findUnique({
      where: { id: receptionId },
      include: { souscription: { include: { pack: true } } },
    });

    if (!rec) {
      return NextResponse.json({ error: "Réception introuvable" }, { status: 404 });
    }

    if (rec.statut !== "PLANIFIEE") {
      const statutLabel: Record<string, string> = { LIVREE: "livrée", ANNULEE: "déjà annulée" };
      return NextResponse.json(
        { error: `Impossible d'annuler : cette livraison est ${statutLabel[rec.statut] ?? rec.statut.toLowerCase()}` },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.receptionProduitPack.update({
        where: { id: receptionId },
        data: { statut: "ANNULEE" },
      });

      await notifyAdmins(tx, {
        titre: `Livraison annulée — ${rec.souscription.pack.nom}`,
        message: `${adminNom} a annulé la livraison planifiée #${receptionId} pour la souscription #${rec.souscriptionId}.`,
        priorite: "HAUTE",
        actionUrl: "/dashboard/admin/packs",
      });

      return u;
    });

    return NextResponse.json(updated);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    console.error("DELETE /api/admin/packs/receptions/[id]", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
