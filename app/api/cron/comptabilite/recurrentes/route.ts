import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { genererEcheancesDues } from "@/lib/comptabilite/recurrentes";
import { notifyAdmins, auditLog } from "@/lib/notifications";

/**
 * GET /api/cron/comptabilite/recurrentes
 *
 * Cron quotidien — génère les échéances dues de toutes les écritures
 * récurrentes actives (CDC Comptabilité §26 : "créer les écritures
 * automatiques"). Avant cette route, `genererEcheancesDues` existait déjà
 * (lib/comptabilite/recurrentes.ts) mais n'était déclenchable que
 * manuellement via POST /api/comptable/recurrentes/generer — aucune
 * génération ne se produisait jamais sans action du comptable.
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

    const dateReference = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const r = await genererEcheancesDues(tx, dateReference, null);
      if (r.created > 0 || r.skipped > 0) {
        await notifyAdmins(tx, {
          titre: "Écritures récurrentes générées",
          message: `${r.created} écriture(s) récurrente(s) générée(s)${r.skipped > 0 ? `, ${r.skipped} en attente (compte manquant ou période clôturée)` : ""}.`,
          priorite: r.skipped > 0 ? "HAUTE" : "NORMAL",
          actionUrl: "/dashboard/user/comptables/saisie/recurrentes",
        });
      }
      await auditLog(tx, null as unknown as number, "CRON_GENERATION_ECHEANCES_RECURRENTES", "EcritureRecurrente", undefined, { created: r.created, skipped: r.skipped });
      return r;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
