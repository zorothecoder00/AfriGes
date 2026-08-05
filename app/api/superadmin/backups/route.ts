import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/superadmin/backups
 * Historique des dernières sauvegardes comptables (CDC §69) — rend l'écran
 * "Politique de sauvegarde" vérifiable, pas seulement configurable.
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const backups = await prisma.backupLog.findMany({
      orderBy: { dateExecution: "desc" },
      take: 20,
    });
    return NextResponse.json({ success: true, data: backups });
  } catch (error) {
    console.error("GET /api/superadmin/backups", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
