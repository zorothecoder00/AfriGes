import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VISUAL_DEFAULTS: Record<string, string> = {
  "platform.langue": "fr",
  "platform.theme":  "light",
  "platform.nom":    "AfriGes",
};

/**
 * GET /api/app-settings
 * Retourne uniquement les paramètres visuels (langue, thème, nom).
 * Accessible à tout utilisateur authentifié.
 * Utilisé par AppSettingsContext au démarrage pour synchroniser DB → localStorage.
 */
export async function GET() {
  try {

    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: Object.keys(VISUAL_DEFAULTS) } },
    });

    const data = { ...VISUAL_DEFAULTS };
    for (const row of rows) data[row.key] = row.value;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/app-settings", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
