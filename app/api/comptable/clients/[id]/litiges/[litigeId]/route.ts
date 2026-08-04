import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string; litigeId: string }> };

const STATUTS_VALIDES = ["OUVERT", "EN_COURS", "RESOLU", "CLOTURE"];

/**
 * PUT /api/comptable/clients/[id]/litiges/[litigeId]
 * Body: { statut?, notes? } — fait avancer le suivi du litige (CDC §16).
 */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { litigeId } = await params;
    const body = await req.json();
    const { statut, notes } = body as { statut?: string; notes?: string };
    if (statut !== undefined && !STATUTS_VALIDES.includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const existing = await prisma.litigeClient.findUnique({ where: { id: Number(litigeId) } });
    if (!existing) return NextResponse.json({ error: "Litige introuvable" }, { status: 404 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const litige = await prisma.$transaction(async (tx) => {
      const l = await tx.litigeClient.update({
        where: { id: Number(litigeId) },
        data: {
          ...(statut !== undefined && {
            statut,
            // La résolution/clôture fige une date, jamais réécrite par un aller-retour ultérieur.
            ...((statut === "RESOLU" || statut === "CLOTURE") && !existing.dateResolution && { dateResolution: new Date() }),
          }),
          ...(notes !== undefined && { notes: notes || null }),
        },
      });
      await auditLog(tx, userId, "MODIFICATION_LITIGE_CLIENT", "LitigeClient", l.id, { statutAvant: existing.statut, statutApres: l.statut }, meta);
      return l;
    });

    return NextResponse.json({ data: litige });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
