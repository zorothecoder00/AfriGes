import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSuperAdminSession } from "@/lib/authSuperAdmin";
import { auditLog } from "@/lib/notifications";

// Paramètres par défaut si aucune valeur en base
const DEFAULTS: Record<string, string> = {
  // Plateforme
  "platform.nom":       "AfriGes",
  "platform.devise":    "FCFA",
  "platform.langue":    "fr",
  "platform.theme":     "light",
  // Numérotation
  "numbering.facture":  "FAC-{YYYY}-{SEQ}",
  "numbering.vente":    "VNT-{YYYY}-{SEQ}",
  "numbering.mouvement":"MVT-{YYYY}-{SEQ}",
  "numbering.reception":"REC-{YYYY}-{SEQ}",
  // Sécurité
  "security.pwd_min_length":   "8",
  "security.pwd_require_upper":"true",
  "security.pwd_require_digit":"true",
  "security.pwd_require_special":"false",
  "security.session_duration": "3600",
  "security.max_failed_attempts":"5",
  "security.lockout_duration": "900",
  // Comptable
  "accounting.exercice_debut": "01-01",
  "accounting.tva_taux":       "18",
  "accounting.tva_actif":      "true",
  "accounting.methode_amortissement":"lineaire",
  // Financier
  "financial.plafond_caisse":  "1000000",
  "financial.seuil_alerte_caisse":"100000",
  "financial.devise_secondaire":"",
  // Stock
  "stock.methode_valorisation": "FIFO",
  "stock.seuil_alerte_global":  "10",
  "stock.inventaire_auto":      "false",
  // Sauvegarde
  "backup.frequence":   "quotidien",
  "backup.retention":   "30",
  "backup.heure":       "02:00",
};

export async function GET() {
  try {
    const session = await getSuperAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const rows = await prisma.systemSetting.findMany();
    const map: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) map[row.key] = row.value;

    return NextResponse.json({ success: true, data: map });
  } catch (error) {
    console.error("GET /api/superadmin/settings", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSuperAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const superAdminId = parseInt(session.user.id);
    const body: Record<string, string> = await req.json();

    for (const [key, value] of Object.entries(body)) {
      await prisma.systemSetting.upsert({
        where:  { key },
        create: { key, value, category: key.split(".")[0], updatedBy: superAdminId },
        update: { value, updatedBy: superAdminId },
      });
    }

    await auditLog(prisma, superAdminId, "SUPERADMIN_UPDATE_SETTINGS", "SystemSetting");
    return NextResponse.json({ success: true, message: "Paramètres sauvegardés" });
  } catch (error) {
    console.error("PATCH /api/superadmin/settings", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
