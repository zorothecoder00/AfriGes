import { NextResponse } from "next/server";
import { PrioriteNotification, StatutCredit, StatutEcheanceCredit, TypePaiement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { notifyAdmins, auditLog } from "@/lib/notifications";
import { validerNumeroJour, montantAttenduDuJour, parseDateCollecte } from "@/lib/remboursementCredit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/rvc/credits/[id]/rembourser
 * Body: { montant, modePaiement?, notes? }
 *
 * Encaissement direct d'un remboursement de crédit par le Responsable Vente
 * Crédit. Scoped au PDV du RVC. Même logique d'imputation que la route caissier
 * (statut CONFIRME → effets financiers appliqués immédiatement).
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = parseInt(id);
    if (isNaN(creditId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    // montant = « montant encaissé » ; observation/notes = « observation »
    const { montant, modePaiement, notes, observation, numeroJour, agentCollecteurId, dateCollecte } = body;

    if (!montant || Number(montant) <= 0) {
      return NextResponse.json({ error: "Le montant doit être positif" }, { status: 400 });
    }

    const numeroJourNum = numeroJour != null && numeroJour !== "" ? parseInt(String(numeroJour)) : null;
    const observationTxt = (observation ?? notes) || null;

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    let rvcPdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff) return NextResponse.json({ error: "Aucun PDV associé" }, { status: 400 });
      rvcPdvId = aff.pointDeVenteId;
    }

    const credit = await prisma.creditClient.findUnique({
      where: { id: creditId },
      include: {
        client: { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (!credit) return NextResponse.json({ error: "Crédit introuvable" }, { status: 404 });

    // Vérification PDV — le crédit doit appartenir au PDV du RVC
    if (rvcPdvId !== null && credit.pointDeVenteId !== rvcPdvId) {
      return NextResponse.json({ error: "Ce crédit n'appartient pas à votre point de vente" }, { status: 403 });
    }

    const statutsAutorisés: StatutCredit[] = [StatutCredit.ACTIF, StatutCredit.EN_RETARD];
    if (!statutsAutorisés.includes(credit.statut)) {
      return NextResponse.json({ error: "Seuls les crédits ACTIF ou EN_RETARD peuvent être remboursés" }, { status: 422 });
    }

    const erreurJour = validerNumeroJour(numeroJourNum, credit.dureeJours);
    if (erreurJour) return NextResponse.json({ error: erreurJour }, { status: 400 });

    const montantVerse    = Number(montant);
    const montantEffectif = Math.min(montantVerse, Number(credit.soldeRestant));
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // ── Imputation sur les échéances ──────────────────────────────────────
      const echeances = await tx.echeanceCredit.findMany({
        where: { creditId, statut: { in: [StatutEcheanceCredit.EN_ATTENTE, StatutEcheanceCredit.PARTIEL] } },
        orderBy: { dateEcheance: "asc" },
      });

      let budget = montantEffectif;
      for (const ec of echeances) {
        if (budget <= 0) break;
        const restant = Number(ec.montantDu) - Number(ec.montantPaye);

        let penalite = Number(ec.penalite ?? 0);
        if (ec.dateEcheance < now && Number(credit.tauxPenalite) > 0) {
          const jours = Math.max(0, Math.floor((now.getTime() - ec.dateEcheance.getTime()) / 86400000));
          penalite = Number((Number(ec.montantDu) * (Number(credit.tauxPenalite) / 100) * jours).toFixed(2));
        }

        if (budget >= restant) {
          await tx.echeanceCredit.update({
            where: { id: ec.id },
            data:  { montantPaye: Number(ec.montantDu), statut: StatutEcheanceCredit.PAYE, penalite },
          });
          budget -= restant;
        } else {
          await tx.echeanceCredit.update({
            where: { id: ec.id },
            data:  { montantPaye: { increment: budget }, statut: StatutEcheanceCredit.PARTIEL, penalite },
          });
          budget = 0;
        }
      }

      // ── Créer le remboursement ────────────────────────────────────────────
      const montantAttendu = await montantAttenduDuJour(tx, creditId, numeroJourNum);
      const remboursement = await tx.remboursementCredit.create({
        data: {
          creditId,
          montant:          montantEffectif,
          modePaiement:     (modePaiement as TypePaiement) ?? TypePaiement.ESPECES,
          notes:            observationTxt,
          enregistreParId:  userId,
          // Agent collecteur = celui indiqué, sinon l'utilisateur qui encaisse
          agentCollecteurId: agentCollecteurId ? parseInt(String(agentCollecteurId)) : userId,
          numeroJour:       numeroJourNum,
          montantAttendu,
          dateRemboursement: parseDateCollecte(dateCollecte) ?? new Date(),
          statut:           "CONFIRME", // encaissement direct par le RVC — effets financiers déjà appliqués
        },
      });

      // ── Mise à jour du crédit ─────────────────────────────────────────────
      const newSolde = Math.max(0, Number(credit.soldeRestant) - montantEffectif);
      const newRembourse = Number(credit.montantRembourse) + montantEffectif;

      let newStatut: StatutCredit;
      if (newSolde <= 0) {
        newStatut = StatutCredit.SOLDE;
        await tx.echeanceCredit.updateMany({
          where: { creditId, statut: { in: [StatutEcheanceCredit.EN_ATTENTE, StatutEcheanceCredit.PARTIEL] } },
          data:  { statut: StatutEcheanceCredit.PAYE },
        });
      } else {
        const retard = await tx.echeanceCredit.findFirst({
          where: { creditId, statut: { in: [StatutEcheanceCredit.EN_ATTENTE, StatutEcheanceCredit.PARTIEL] }, dateEcheance: { lt: now } },
        });
        newStatut = retard ? StatutCredit.EN_RETARD : StatutCredit.ACTIF;
      }

      await tx.creditClient.update({
        where: { id: creditId },
        data:  { montantRembourse: newRembourse, soldeRestant: newSolde, statut: newStatut },
      });

      // ── Mise à jour soldeActuel du client ─────────────────────────────────
      await tx.client.update({
        where: { id: credit.clientId },
        data:  { soldeActuel: { decrement: montantEffectif } },
      });

      await auditLog(tx, userId, "REMBOURSEMENT_CREDIT_RVC", "RemboursementCredit", remboursement.id);

      const estSolde = newStatut === StatutCredit.SOLDE;
      await notifyAdmins(tx, {
        titre:    estSolde ? "Crédit soldé (RVC)" : "Remboursement crédit (RVC)",
        message:  estSolde
          ? `Le crédit ${credit.reference} de ${credit.client.prenom} ${credit.client.nom} est intégralement remboursé.`
          : `Remboursement de ${montantEffectif.toLocaleString("fr-FR")} FCFA sur ${credit.reference}. Solde restant : ${newSolde.toLocaleString("fr-FR")} FCFA.`,
        priorite: estSolde ? PrioriteNotification.HAUTE : PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/credits/${creditId}`,
      });

      return remboursement;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/rvc/credits/[id]/rembourser error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
