import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { marquerRecompenseUtilisee } from "@/lib/recompensesFidelite";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/marketing/recompenses/echanges/[id]
 * Marque un échange DISPONIBLE comme UTILISEE (remise physique/avantage
 * confirmé par le staff).
 */
export async function PATCH(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const echangeId = Number(id);
    if (isNaN(echangeId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId = Number(session.user.id);
    try {
      const echange = await prisma.$transaction(async (tx) => {
        const e = await marquerRecompenseUtilisee(tx, echangeId);
        await auditLog(tx, userId, "RECOMPENSE_UTILISEE", "RecompenseEchange", echangeId);
        return e;
      });
      return NextResponse.json({ data: echange });
    } catch (e) {
      if (e instanceof Error && e.message === "ECHANGE_INTROUVABLE") return NextResponse.json({ error: "Échange introuvable" }, { status: 404 });
      if (e instanceof Error && e.message === "ECHANGE_DEJA_TRAITE") return NextResponse.json({ error: "Cet échange a déjà été traité" }, { status: 400 });
      throw e;
    }
  } catch (e) {
    console.error("PATCH /api/admin/marketing/recompenses/echanges/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
