import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutRemboursementFrais } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/remboursements-frais/[id]
 * Workflow: { action: "APPROUVER" | "REJETER" | "MARQUER_PAYE", commentaire? }
 * Édition (EN_ATTENTE seulement): { libelle?, montant?, dateFrais?, justificatif?, notes? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id }  = await params;
    const body    = await req.json();
    const { action, commentaire, ...editFields } = body;

    const remb = await prisma.remboursementFrais.findUnique({ where: { id: Number(id) } });
    if (!remb) return NextResponse.json({ error: "Remboursement introuvable" }, { status: 404 });

    // ── Workflow ──────────────────────────────────────────────────────────────
    if (action) {
      const TRANSITIONS: Record<string, { from: StatutRemboursementFrais[]; to: StatutRemboursementFrais }> = {
        APPROUVER:    { from: ["EN_ATTENTE"],          to: "APPROUVE" },
        REJETER:      { from: ["EN_ATTENTE"],           to: "REJETE"   },
        MARQUER_PAYE: { from: ["APPROUVE"],             to: "PAYE"     },
      };
      const t = TRANSITIONS[action];
      if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
      if (!t.from.includes(remb.statut)) return NextResponse.json({ error: `Impossible depuis ${remb.statut}` }, { status: 422 });

      const updated = await prisma.remboursementFrais.update({
        where: { id: Number(id) },
        data: {
          statut:      t.to,
          traiteParId: parseInt(session.user.id),
          commentaire: commentaire ?? null,
        },
        include: {
          profilRH: { select: { id: true, matricule: true, gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } } },
        },
      });
      await prisma.auditLog.create({
        data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "RemboursementFrais", entiteId: Number(id), details: `Remboursement #${id} : ${remb.statut} → ${t.to}` },
      });
      return NextResponse.json({ data: updated });
    }

    // ── Édition (EN_ATTENTE seulement) ────────────────────────────────────────
    if (remb.statut !== "EN_ATTENTE") {
      return NextResponse.json({ error: "Seuls les remboursements EN_ATTENTE sont modifiables" }, { status: 422 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (editFields.libelle      !== undefined) data.libelle      = editFields.libelle;
    if (editFields.montant      !== undefined) data.montant      = Number(editFields.montant);
    if (editFields.dateFrais    !== undefined) data.dateFrais    = new Date(editFields.dateFrais);
    if (editFields.justificatif !== undefined) data.justificatif = editFields.justificatif ?? null;
    if (editFields.notes        !== undefined) data.notes        = editFields.notes ?? null;

    const updated = await prisma.remboursementFrais.update({ where: { id: Number(id) }, data });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/remboursements-frais/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
