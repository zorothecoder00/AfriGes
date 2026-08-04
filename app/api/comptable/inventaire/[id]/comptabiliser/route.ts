import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { getRequestMeta } from "@/lib/requestMeta";
import { auditLog } from "@/lib/notifications";
import { comptabiliserEcartInventaire } from "@/lib/comptabilite/ecrituresInventaire";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/comptable/inventaire/[id]/comptabiliser — comptabilise l'écart valorisé d'un InventaireSite VALIDE. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const inventaireSiteId = Number(id);
    if (isNaN(inventaireSiteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);

    const result = await prisma.$transaction(async (tx) => {
      const r = await comptabiliserEcartInventaire(tx, inventaireSiteId, userId);
      await auditLog(tx, userId, "COMPTABILISATION_ECART_INVENTAIRE", "InventaireSite", inventaireSiteId, { ecartValorise: r.ecartValorise }, meta);
      return r;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    if (e instanceof Error && ["INVENTAIRE_INTROUVABLE", "INVENTAIRE_NON_VALIDE", "INVENTAIRE_DEJA_COMPTABILISE"].includes(e.message)) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
