import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/horaires/[id]
 * Modifier une config d'horaires.
 * Si estDefaut=true, désactive les autres.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const {
      nom, heureArrivee, heureDepart,
      pauseDejeunnerMinutes, dureeJourneeMinutes,
      toleranceRetardMin, joursOuvres, estDefaut,
    } = body;

    const existing = await prisma.configHoraire.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Config introuvable" }, { status: 404 });

    // Recalcul duree si les heures ont changé
    const newArrivee = heureArrivee ?? existing.heureArrivee;
    const newDepart  = heureDepart  ?? existing.heureDepart;
    let duree = dureeJourneeMinutes ?? existing.dureeJourneeMinutes;
    if (dureeJourneeMinutes === undefined && (heureArrivee || heureDepart) && newArrivee && newDepart) {
      const [ha, ma] = newArrivee.split(":").map(Number);
      const [hd, md] = newDepart.split(":").map(Number);
      const pause    = pauseDejeunnerMinutes ?? existing.pauseDejeunnerMinutes ?? 0;
      duree = (hd * 60 + md) - (ha * 60 + ma) - pause;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (estDefaut === true) {
        await tx.configHoraire.updateMany({
          where: { estDefaut: true, id: { not: Number(id) } },
          data:  { estDefaut: false },
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = {};
      if (nom                   !== undefined) data.nom                   = nom ?? null;
      if (heureArrivee          !== undefined) data.heureArrivee          = heureArrivee ?? null;
      if (heureDepart           !== undefined) data.heureDepart           = heureDepart  ?? null;
      if (pauseDejeunnerMinutes !== undefined) data.pauseDejeunnerMinutes = pauseDejeunnerMinutes ?? null;
      if (duree                 !== undefined) data.dureeJourneeMinutes   = duree;
      if (toleranceRetardMin    !== undefined) data.toleranceRetardMin    = toleranceRetardMin ?? null;
      if (joursOuvres           !== undefined) data.joursOuvres           = joursOuvres;
      if (estDefaut             !== undefined) data.estDefaut             = estDefaut;

      return tx.configHoraire.update({ where: { id: Number(id) }, data });
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/horaires/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/rh/horaires/[id]
 * Supprime si aucun collaborateur ne l'utilise, sinon erreur.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const config = await prisma.configHoraire.findUnique({
      where:   { id: Number(id) },
      include: { _count: { select: { collaborateurs: true } } },
    });
    if (!config) return NextResponse.json({ error: "Config introuvable" }, { status: 404 });

    if (config._count.collaborateurs > 0) {
      return NextResponse.json(
        { error: `Impossible : ${config._count.collaborateurs} collaborateur(s) utilisent cette config. Réaffectez-les d'abord.` },
        { status: 409 }
      );
    }

    await prisma.configHoraire.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: "Config supprimée" });
  } catch (error) {
    console.error("DELETE /api/admin/rh/horaires/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
