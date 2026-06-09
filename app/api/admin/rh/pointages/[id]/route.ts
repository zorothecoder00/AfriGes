import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutPointage } from "@prisma/client";
import { calculerPointage, getConfigHoraire } from "@/lib/calcPointage";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/pointages/[id]
 * Modifier un pointage — recalcule automatiquement les valeurs dérivées.
 * Body: { statut?, heureArrivee?, heureDepart?, notes?, justificatif? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { statut, heureArrivee, heureDepart, notes, justificatif } = body;

    const existing = await prisma.pointage.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Pointage introuvable" }, { status: 404 });

    const arrivee = heureArrivee !== undefined
      ? (heureArrivee ? new Date(heureArrivee) : null)
      : existing.heureArrivee;
    const depart  = heureDepart !== undefined
      ? (heureDepart  ? new Date(heureDepart)  : null)
      : existing.heureDepart;
    const statutFinal = statut ?? existing.statut;

    const config = await getConfigHoraire(prisma, existing.profilRHId);
    const calcul = calculerPointage(arrivee, depart, config, existing.date, statutFinal);

    const updated = await prisma.pointage.update({
      where: { id: Number(id) },
      data: {
        statut:        calcul.statutAuto as StatutPointage,
        heureArrivee:  arrivee,
        heureDepart:   depart,
        notes:         notes         !== undefined ? (notes         ?? null) : existing.notes,
        justificatif:  justificatif  !== undefined ? (justificatif  ?? null) : existing.justificatif,
        tempsTotal:    calcul.tempsTotal,
        retardMinutes: calcul.retardMinutes,
        heuresSup:     calcul.heuresSup,
        // Annuler la validation si le pointage est modifié
        valideParId:   null,
        valideA:       null,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/pointages/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/rh/pointages/[id]
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.pointage.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Pointage introuvable" }, { status: 404 });

    await prisma.pointage.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: "Pointage supprimé" });
  } catch (error) {
    console.error("DELETE /api/admin/rh/pointages/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
