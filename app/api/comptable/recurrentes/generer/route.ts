import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { genererEcheancesDues } from "@/lib/comptabilite/recurrentes";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * POST /api/comptable/recurrentes/generer
 * Body: { date?: string } — défaut : aujourd'hui.
 * Génère toutes les échéances dues des écritures récurrentes actives (CDC §26).
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dateReference = body?.date ? new Date(body.date) : new Date();
    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);

    const result = await prisma.$transaction(async (tx) => {
      const r = await genererEcheancesDues(tx, dateReference, userId);
      await auditLog(tx, userId, "GENERATION_ECHEANCES_RECURRENTES", "EcritureRecurrente", undefined, { date: dateReference.toISOString(), created: r.created, skipped: r.skipped }, meta);
      return r;
    });

    return NextResponse.json({
      success: true,
      message: `${result.created} échéance(s) générée(s)${result.skipped > 0 ? ` · ${result.skipped} en attente (compte manquant ou période clôturée)` : ""}`,
      data: result,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
