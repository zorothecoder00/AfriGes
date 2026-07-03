import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { getRHScope } from "@/lib/scopeRH";
import {
  alertesFinContrat,
  alertesDocumentsExpirants,
  alertesEvaluationsProg,
  alertesFormationsAsuivre,
  alertesCongesEnAttente,
} from "@/lib/notificationsRH";

/**
 * Espace déclencheur des notifications RH (CDC) — lancement manuel par le RH ou l'admin.
 * Complète le CRON quotidien (/api/cron/rh-alertes) : ici les valideurs peuvent
 * déclencher un scan à la demande.
 *
 * GET  /api/admin/rh/notifications/declencheurs → liste des déclencheurs disponibles
 * POST /api/admin/rh/notifications/declencheurs → { trigger: <clé> | "all" }, exécute le(s) scan(s)
 *
 * Accès : ADMIN, SUPER_ADMIN, RESPONSABLE_RH (getRHSession).
 */

const TRIGGERS: Record<string, { label: string; run: (ids?: number[] | null) => Promise<number> }> = {
  finContrat:       { label: "Fin de contrat",          run: alertesFinContrat },
  documentExpirant: { label: "Document expirant",       run: alertesDocumentsExpirants },
  evaluationProg:   { label: "Évaluation programmée",   run: alertesEvaluationsProg },
  formationAsuivre: { label: "Formation à suivre",      run: alertesFormationsAsuivre },
  validationConge:  { label: "Validation de congé",     run: alertesCongesEnAttente },
};

type TriggerKey = keyof typeof TRIGGERS;

export async function GET() {
  const session = await getRHSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  return NextResponse.json({
    data: (Object.keys(TRIGGERS) as TriggerKey[]).map((key) => ({ key, label: TRIGGERS[key].label })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { trigger } = await req.json() as { trigger?: string };
    if (!trigger) return NextResponse.json({ error: "trigger est obligatoire" }, { status: 400 });

    const keys: TriggerKey[] =
      trigger === "all"
        ? (Object.keys(TRIGGERS) as TriggerKey[])
        : (trigger in TRIGGERS ? [trigger as TriggerKey] : []);

    if (keys.length === 0) {
      return NextResponse.json({ error: `Déclencheur inconnu : ${trigger}` }, { status: 400 });
    }

    // Périmètre : ADMIN/SUPER_ADMIN = global (null) ; RESPONSABLE_RH = collaborateurs de son PDV.
    const scope = await getRHScope(session);

    const results: Record<string, number> = {};
    let total = 0;
    for (const key of keys) {
      const n = await TRIGGERS[key].run(scope.profilRHIds);
      results[key] = n;
      total += n;
    }

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "DECLENCHER_NOTIFICATIONS_RH",
        entite:   "Notification",
        details:  { trigger, results, total, scope: scope.isAdmin ? "GLOBAL" : "PDV" },
      },
    });

    return NextResponse.json({ data: { trigger, results, total, scope: scope.isAdmin ? "GLOBAL" : "PDV" } });
  } catch (error) {
    console.error("POST /api/admin/rh/notifications/declencheurs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
