import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/horaires
 * Liste toutes les configs d'horaires
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    // Soft delete : on masque les configs archivées par défaut (CDC §8).
    const actifParam = new URL(req.url).searchParams.get("actif");
    const configs = await prisma.configHoraire.findMany({
      where: actifParam === "all" ? undefined : { actif: true },
      orderBy: [{ estDefaut: "desc" }, { nom: "asc" }],
      include: { _count: { select: { collaborateurs: true } } },
    });

    return NextResponse.json({ data: configs });
  } catch (error) {
    console.error("GET /api/admin/rh/horaires", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/horaires
 * Créer une config d'horaires.
 * Si estDefaut=true, désactive les autres configs par défaut.
 *
 * Body: {
 *   nom?, heureArrivee?, heureDepart?,
 *   pauseDejeunnerMinutes?, dureeJourneeMinutes?,
 *   toleranceRetardMin?, joursOuvres?, estDefaut?
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const {
      nom, heureArrivee, heureDepart,
      pauseDejeunnerMinutes, dureeJourneeMinutes,
      toleranceRetardMin, joursOuvres, estDefaut,
    } = body;

    // Calcul automatique dureeJourneeMinutes si non fourni
    let duree = dureeJourneeMinutes ?? null;
    if (!duree && heureArrivee && heureDepart) {
      const [ha, ma] = heureArrivee.split(":").map(Number);
      const [hd, md] = heureDepart.split(":").map(Number);
      duree = (hd * 60 + md) - (ha * 60 + ma) - (pauseDejeunnerMinutes ?? 0);
    }

    const config = await prisma.$transaction(async (tx) => {
      // Si cette config devient la défaut → désactiver les autres
      if (estDefaut) {
        await tx.configHoraire.updateMany({ where: { estDefaut: true }, data: { estDefaut: false } });
      }
      return tx.configHoraire.create({
        data: {
          nom:                   nom                   ?? null,
          heureArrivee:          heureArrivee          ?? null,
          heureDepart:           heureDepart           ?? null,
          pauseDejeunnerMinutes: pauseDejeunnerMinutes ?? null,
          dureeJourneeMinutes:   duree,
          toleranceRetardMin:    toleranceRetardMin    ?? null,
          joursOuvres:           joursOuvres           ?? [1, 2, 3, 4, 5],
          estDefaut:             estDefaut             ?? false,
          createdById:           parseInt(session.user.id),
        },
      });
    });

    return NextResponse.json({ data: config }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/horaires", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
