import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { chargerParametrageCC, enregistrerDepotCC, extraireMetaRequete } from "@/lib/compteCourant";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string; pid: string }> };

/**
 * POST /api/comptes-courants/[id]/epargne/[pid]/cotiser — capacité DEPOSIT
 * Enregistre une cotisation vers un plan d'épargne (CDC §19.B) : c'est un dépôt
 * (money in) fléché vers le plan → maj solde + écriture comptable + cumul du plan.
 * Passe le plan en ATTEINT dès que l'objectif est couvert.
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("DEPOSIT");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id, pid } = await params;
  const compteId = Number(id);
  const planId = Number(pid);
  if (!compteId || !planId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const montant = Number(body?.montant);
  const modePaiement = typeof body?.modePaiement === "string" && body.modePaiement.trim() ? body.modePaiement.trim() : null;
  if (!montant || isNaN(montant) || montant <= 0) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId },
    select: {
      id: true, numeroCompte: true, statut: true, solde: true, codeAgence: true,
      client: { select: { prenom: true, nom: true } },
    },
  });
  if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  if (compte.statut !== "ACTIF") {
    return NextResponse.json({ error: `Compte ${compte.statut.toLowerCase()} : cotisation impossible` }, { status: 422 });
  }

  const plan = await prisma.planEpargne.findFirst({
    where: { id: planId, compteId },
    select: { id: true, libelle: true, statut: true, objectifMontant: true, montantCumule: true },
  });
  if (!plan) return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
  if (plan.statut !== "EN_COURS") {
    return NextResponse.json({ error: "Ce plan n'est pas en cours" }, { status: 422 });
  }

  const param = await chargerParametrageCC();
  if (montant < Number(param.depotMin)) {
    return NextResponse.json({ error: `Cotisation minimum : ${Number(param.depotMin)} FCFA` }, { status: 422 });
  }
  if (param.depotMax != null && montant > Number(param.depotMax)) {
    return NextResponse.json({ error: `Cotisation maximum : ${Number(param.depotMax)} FCFA` }, { status: 422 });
  }
  const soldeAvant = Number(compte.solde);
  if (param.soldeMaxAutorise != null && soldeAvant + montant > Number(param.soldeMaxAutorise)) {
    return NextResponse.json({ error: `Solde maximum autorisé dépassé (${Number(param.soldeMaxAutorise)} FCFA)` }, { status: 422 });
  }

  const { ip, userAgent } = extraireMetaRequete(req);
  const clientNom = `${compte.client.prenom} ${compte.client.nom}`;
  const userId = Number(session.user.id);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const depot = await enregistrerDepotCC(tx, {
        compteId, numeroCompte: compte.numeroCompte, codeAgence: compte.codeAgence,
        clientNom, montant, userId, param,
        modePaiement, observation: `Cotisation épargne — ${plan.libelle}`,
        ip, userAgent, planEpargneId: planId,
      });

      const objectif = Number(plan.objectifMontant);
      const nouveauCumul = Number(plan.montantCumule) + montant;
      const atteint = nouveauCumul >= objectif;
      const updatedPlan = await tx.planEpargne.update({
        where: { id: planId },
        data: {
          montantCumule: { increment: montant },
          ...(atteint ? { statut: "ATTEINT", dateAtteint: new Date() } : {}),
        },
        select: { id: true, libelle: true, montantCumule: true, objectifMontant: true, statut: true },
      });

      await auditLog(tx, userId, "COTISATION_PLAN_EPARGNE", "PlanEpargne", planId,
        { montant, cumule: nouveauCumul, objectif }, { ip, userAgent });
      await notifyAdmins(tx, {
        titre: atteint ? "Objectif d'épargne atteint 🎯" : "Cotisation épargne",
        message: atteint
          ? `Le plan « ${plan.libelle} » (${clientNom}) a atteint son objectif de ${objectif.toLocaleString("fr-FR")} FCFA.`
          : `Cotisation de ${montant.toLocaleString("fr-FR")} FCFA sur le plan « ${plan.libelle} » (${clientNom}). Cumul : ${nouveauCumul.toLocaleString("fr-FR")} / ${objectif.toLocaleString("fr-FR")} FCFA.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/comptes-courants/${compteId}`,
      });

      return {
        mouvement: depot.mouvement, soldeApres: depot.soldeApres,
        plan: { ...updatedPlan, montantCumule: Number(updatedPlan.montantCumule), objectifMontant: Number(updatedPlan.objectifMontant) },
        atteint,
      };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (e) {
    console.error("POST /api/comptes-courants/[id]/epargne/[pid]/cotiser", e);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement de la cotisation" }, { status: 500 });
  }
}
