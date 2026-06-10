import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { StatutPointage } from "@prisma/client";
import { calculerPointage, getConfigHoraire } from "@/lib/calcPointage";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/responsableRH/pointages/[id]
 * Modifier un pointage ou le valider
 * Body édition : { statut?, heureArrivee?, heureDepart?, notes?, justificatif? }
 * Body validation : { action: "VALIDER" }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id }  = await params;
    const body    = await req.json();
    const { action, ...editFields } = body;

    const pointage = await prisma.pointage.findUnique({ where: { id: Number(id) } });
    if (!pointage) return NextResponse.json({ error: "Pointage introuvable" }, { status: 404 });

    if (action === "VALIDER") {
      const updated = await prisma.pointage.update({
        where: { id: Number(id) },
        data:  { valideParId: parseInt(session.user.id), valideA: new Date() },
      });
      return NextResponse.json({ data: updated });
    }

    // ── Édition ──────────────────────────────────────────────────────────────
    const arrivee = editFields.heureArrivee !== undefined
      ? (editFields.heureArrivee ? new Date(editFields.heureArrivee) : null)
      : pointage.heureArrivee;
    const depart = editFields.heureDepart !== undefined
      ? (editFields.heureDepart ? new Date(editFields.heureDepart) : null)
      : pointage.heureDepart;
    const newStatut = editFields.statut ?? pointage.statut;

    const config = await getConfigHoraire(prisma, pointage.profilRHId);
    const calcul = calculerPointage(arrivee, depart, config, pointage.date, newStatut);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      statut:        calcul.statutAuto as StatutPointage,
      heureArrivee:  arrivee,
      heureDepart:   depart,
      tempsTotal:    calcul.tempsTotal,
      retardMinutes: calcul.retardMinutes,
      heuresSup:     calcul.heuresSup,
    };
    if (editFields.notes        !== undefined) updateData.notes        = editFields.notes        ?? null;
    if (editFields.justificatif !== undefined) updateData.justificatif = editFields.justificatif ?? null;

    const updated = await prisma.pointage.update({ where: { id: Number(id) }, data: updateData });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/responsableRH/pointages/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
