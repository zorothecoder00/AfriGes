import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { extraireMetaRequete } from "@/lib/compteCourant";
import { auditLog } from "@/lib/notifications";
import { calculerProgression, type PlanBase } from "@/lib/epargneProgrammee";

type Ctx = { params: Promise<{ id: string; pid: string }> };

const planSelect = {
  id: true, libelle: true, objectifMontant: true, frequence: true, montantCotisation: true,
  dateDebut: true, dateEcheance: true, montantCumule: true, statut: true, dateAtteint: true,
  observation: true, createdAt: true,
  creePar: { select: { nom: true, prenom: true } },
  _count: { select: { cotisations: true } },
};

/**
 * PATCH /api/comptes-courants/[id]/epargne/[pid] — capacité CREATE
 * action: "ABANDONNER" | "REPRENDRE", ou édition des paramètres (plan EN_COURS).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("CREATE");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id, pid } = await params;
  const compteId = Number(id);
  const planId = Number(pid);
  if (!compteId || !planId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const plan = await prisma.planEpargne.findFirst({
    where: { id: planId, compteId },
    select: { id: true, statut: true, objectifMontant: true, montantCumule: true, dateEcheance: true },
  });
  if (!plan) return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : null;
  const userId = Number(session.user.id);
  const { ip, userAgent } = extraireMetaRequete(req);

  const data: Prisma.PlanEpargneUpdateInput = {};
  let auditAction = "MODIFICATION_PLAN_EPARGNE";

  if (action === "ABANDONNER") {
    if (plan.statut !== "EN_COURS") return NextResponse.json({ error: "Seul un plan en cours peut être abandonné" }, { status: 422 });
    data.statut = "ABANDONNE";
    auditAction = "ABANDON_PLAN_EPARGNE";
  } else if (action === "REPRENDRE") {
    if (plan.statut !== "ABANDONNE") return NextResponse.json({ error: "Seul un plan abandonné peut être repris" }, { status: 422 });
    if (new Date(plan.dateEcheance) <= new Date()) return NextResponse.json({ error: "Échéance dépassée : impossible de reprendre" }, { status: 422 });
    data.statut = "EN_COURS";
    auditAction = "REPRISE_PLAN_EPARGNE";
  } else {
    // Édition des paramètres (uniquement tant que le plan est EN_COURS).
    if (plan.statut !== "EN_COURS") return NextResponse.json({ error: "Ce plan n'est pas modifiable" }, { status: 422 });
    if (typeof body?.libelle === "string" && body.libelle.trim()) data.libelle = body.libelle.trim();
    if (body?.objectifMontant != null) {
      const v = Number(body.objectifMontant);
      if (isNaN(v) || v <= 0) return NextResponse.json({ error: "Montant objectif invalide" }, { status: 400 });
      if (v < Number(plan.montantCumule)) return NextResponse.json({ error: "L'objectif ne peut être inférieur au cumul déjà versé" }, { status: 400 });
      data.objectifMontant = v;
    }
    if (body?.montantCotisation != null) {
      const v = Number(body.montantCotisation);
      if (isNaN(v) || v <= 0) return NextResponse.json({ error: "Montant de cotisation invalide" }, { status: 400 });
      data.montantCotisation = v;
    }
    if (body?.dateEcheance != null) {
      const d = new Date(body.dateEcheance);
      if (isNaN(d.getTime()) || d <= new Date()) return NextResponse.json({ error: "Échéance invalide" }, { status: 400 });
      data.dateEcheance = d;
    }
    if (typeof body?.observation === "string") data.observation = body.observation.trim() || null;
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.planEpargne.update({ where: { id: planId }, data, select: planSelect });
    await auditLog(tx, userId, auditAction, "PlanEpargne", planId, undefined, { ip, userAgent });
    return u;
  });

  return NextResponse.json({ data: { ...updated, progression: calculerProgression(updated as unknown as PlanBase) } });
}
