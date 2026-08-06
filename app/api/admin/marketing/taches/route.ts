import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

/**
 * GET /api/admin/marketing/taches
 * Tâches créées par l'action CREER_TACHE (CDC §19). Par défaut, ne renvoie
 * que les tâches assignées à l'utilisateur courant ("Mes tâches marketing") ;
 * `?toutes=1` renvoie tout (vue admin/responsable marketing).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const sp = req.nextUrl.searchParams;
    const toutes = sp.get("toutes") === "1";
    const statut = sp.get("statut");
    const userId = Number(session.user.id);

    const taches = await prisma.tacheMarketing.findMany({
      where: {
        ...(toutes ? {} : { assigneAId: userId }),
        ...(statut ? { statut: statut as never } : {}),
      },
      include: {
        client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        assigneA: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: [{ statut: "asc" }, { dateEcheance: "asc" }],
    });

    return NextResponse.json({ data: taches });
  } catch (e) {
    console.error("GET /api/admin/marketing/taches", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
