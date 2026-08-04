import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { genererEcartsChangeCloture } from "@/lib/comptabilite/ecartsChange";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/comptable/exercices/[id]/ecarts-change
 * Écarts de change à la clôture (CDC §27) — aperçu (dry-run) : réévalue les
 * soldes de bilan en devise étrangère au taux de clôture courant sans rien
 * comptabiliser, pour que le comptable valide le taux avant de lancer le POST.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const exercice = await prisma.exerciceComptable.findUnique({ where: { id: Number(id) } });
    if (!exercice) return NextResponse.json({ error: "Exercice introuvable" }, { status: 404 });

    const userId = Number(session.user.id);
    const etat = await genererEcartsChangeCloture(prisma, exercice.annee, userId, { dryRun: true });
    return NextResponse.json({ data: etat });
  } catch (error) {
    console.error("GET /api/comptable/exercices/[id]/ecarts-change", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/exercices/[id]/ecarts-change
 * Comptabilise les écarts de change (journal OD, comptes 476/477) — idempotent
 * par référence, peut être relancé sans risque après correction d'un taux.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const exercice = await prisma.exerciceComptable.findUnique({ where: { id: Number(id) } });
    if (!exercice) return NextResponse.json({ error: "Exercice introuvable" }, { status: 404 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const etat = await prisma.$transaction(async (tx) => {
      const r = await genererEcartsChangeCloture(tx, exercice.annee, userId, { dryRun: false });
      if (r.lignes.length > 0) {
        await auditLog(tx, userId, "ECARTS_CHANGE_CLOTURE", "ExerciceComptable", exercice.id, {
          annee: exercice.annee, totalGains: r.totalGains, totalPertes: r.totalPertes, nbLignes: r.lignes.length,
        }, meta);
      }
      return r;
    });

    return NextResponse.json({ data: etat });
  } catch (error) {
    console.error("POST /api/comptable/exercices/[id]/ecarts-change", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
