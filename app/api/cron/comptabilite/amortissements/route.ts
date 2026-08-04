import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { genererDotationsDuMois } from "@/lib/comptabilite/immobilisations";
import { notifyAdmins, auditLog } from "@/lib/notifications";

/**
 * GET /api/cron/comptabilite/amortissements
 *
 * Cron mensuel (1er du mois) — génère la dotation d'amortissement du mois
 * pour toutes les immobilisations EN_SERVICE (CDC Comptabilité §22 :
 * "le système calcule : amortissement mensuel"). Avant cette route,
 * `genererDotationsDuMois` existait déjà (lib/comptabilite/immobilisations.ts,
 * en boucle sur `genererDotationPeriode`) mais n'était déclenchable que
 * manuellement, immobilisation par immobilisation, via
 * POST /api/comptable/immobilisations/[id]/amortir.
 *
 * Protégé par CRON_SECRET.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret") || req.headers.get("authorization")?.replace("Bearer ", "");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || secret !== cronSecret) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const now = new Date();
    const annee = now.getFullYear();
    const mois = now.getMonth() + 1;

    const result = await prisma.$transaction(async (tx) => {
      const r = await genererDotationsDuMois(tx, annee, mois, null);
      if (r.created > 0) {
        await notifyAdmins(tx, {
          titre: "Dotations d'amortissement générées",
          message: `${r.created} dotation(s) d'amortissement générée(s) pour ${String(mois).padStart(2, "0")}/${annee} (${r.skipped} immobilisation(s) sans dotation ce mois-ci sur ${r.total}).`,
          priorite: "NORMAL",
          actionUrl: "/dashboard/user/comptables/immobilisations",
        });
      }
      await auditLog(tx, null as unknown as number, "CRON_GENERATION_DOTATIONS_AMORTISSEMENT", "Immobilisation", undefined, { annee, mois, created: r.created, skipped: r.skipped, total: r.total });
      return r;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
