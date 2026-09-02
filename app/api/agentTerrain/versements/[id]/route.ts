import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { recalculerSouscriptionApresVersements } from "@/lib/versementPack";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/agentTerrain/versements/[id]
 * Corrige un versement pack collecté par l'agent terrain lui-même, tant qu'il
 * est encore EN_ATTENTE (pas encore confirmé par le caissier — au-delà,
 * l'effet financier est déjà appliqué et la correction relève du caissier/
 * admin, cf. séparation des tâches).
 *
 * Body: { datePaiement?: string (ISO date), montant?: number, notes?: string }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const versementId = parseInt(id);
    if (isNaN(versementId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { datePaiement, montant, notes } = body as { datePaiement?: string; montant?: number; notes?: string | null };

    if (!datePaiement && montant === undefined && notes === undefined) {
      return NextResponse.json({ error: "Aucun champ à modifier" }, { status: 400 });
    }

    let newDate: Date | undefined;
    if (datePaiement) {
      newDate = new Date(datePaiement);
      if (isNaN(newDate.getTime())) return NextResponse.json({ error: "Date invalide" }, { status: 400 });
      if (newDate > new Date()) return NextResponse.json({ error: "La date ne peut pas être dans le futur" }, { status: 400 });
    }
    if (montant !== undefined && (isNaN(montant) || montant <= 0)) {
      return NextResponse.json({ error: "Le montant doit être supérieur à 0" }, { status: 400 });
    }

    const agentId = parseInt(session.user.id);

    const result = await prisma.$transaction(async (tx) => {
      const versement = await tx.versementPack.findUnique({
        where: { id: versementId },
        include: { souscription: { select: { id: true, statut: true } } },
      });
      if (!versement) throw new Error("Versement introuvable");
      if (versement.encaisseParId !== agentId) throw new Error("ACCES_REFUSE");
      if (versement.statut !== "EN_ATTENTE") throw new Error("VERSEMENT_DEJA_CONFIRME");
      if (versement.souscription.statut === "ANNULE") throw new Error("SOUSCRIPTION_ANNULEE");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {};
      if (newDate) updateData.datePaiement = newDate;
      if (montant !== undefined) updateData.montant = montant;
      if (notes !== undefined) updateData.notes = notes ?? null;

      await tx.versementPack.update({ where: { id: versementId }, data: updateData });
      // EN_ATTENTE n'a aucun effet financier tant qu'il n'est pas confirmé,
      // mais on garde le recalcul par cohérence/sécurité si le statut a changé entre-temps.
      if (montant !== undefined) {
        await recalculerSouscriptionApresVersements(tx, versement.souscription.id, newDate ?? versement.datePaiement);
      }

      await auditLog(tx, agentId, "VERSEMENT_PACK_TERRAIN_CORRIGE", "VersementPack", versementId);

      return { id: versementId };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    console.error("PATCH /api/agentTerrain/versements/[id]:", error);
    if (msg === "Versement introuvable") return NextResponse.json({ error: msg }, { status: 404 });
    if (msg === "ACCES_REFUSE") return NextResponse.json({ error: "Accès refusé : ce versement n'a pas été collecté par vous" }, { status: 403 });
    if (msg === "VERSEMENT_DEJA_CONFIRME") return NextResponse.json({ error: "Ce versement a déjà été confirmé par le caissier : contactez-le pour toute correction" }, { status: 422 });
    if (msg === "SOUSCRIPTION_ANNULEE") return NextResponse.json({ error: "La souscription associée n'est pas modifiable" }, { status: 422 });
    if (msg.includes("dépasse le montant total")) return NextResponse.json({ error: msg }, { status: 400 });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
