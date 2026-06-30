import { NextResponse } from "next/server";
import { PrioriteNotification, Role, StatutCredit, StatutEcheanceCredit, TypePaiement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { validerNumeroJour, montantAttenduDuJour, parseDateCollecte } from "@/lib/remboursementCredit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * ==========================
 * POST /api/admin/credits/[id]/remboursements
 * ==========================
 * Enregistre un remboursement sur un crédit ACTIF ou EN_RETARD.
 *
 * Body: { montant, modePaiement?, notes? }
 *
 * Logique d'imputation :
 *  1. Récupère les échéances EN_ATTENTE ou PARTIEL, triées par date ASC (les plus anciennes d'abord)
 *  2. Impute le montant versé sur chaque échéance jusqu'à épuisement
 *  3. Calcule les pénalités (informatif) sur les échéances échues
 *  4. Met à jour credit.montantRembourse, credit.soldeRestant, credit.statut
 *  5. Décrémente client.soldeActuel
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { montant, modePaiement, notes, observation, numeroJour, agentCollecteurId, dateCollecte } = body;

    if (!montant || Number(montant) <= 0) {
      return NextResponse.json({ message: "Le montant doit être positif" }, { status: 400 });
    }

    const numeroJourNum = numeroJour != null && numeroJour !== "" ? parseInt(String(numeroJour)) : null;

    const result = await prisma.$transaction(async (tx) => {
      const credit = await tx.creditClient.findUnique({
        where: { id: creditId },
        include: { client: { select: { id: true, nom: true, prenom: true } } },
      });
      if (!credit) throw new Error("CREDIT_INTROUVABLE");

      const statutsAutorisés = [StatutCredit.ACTIF, StatutCredit.EN_RETARD];
      if (!(statutsAutorisés as StatutCredit[]).includes(credit.statut)) throw new Error("CREDIT_NON_REMBOURSABLE");

      const erreurJour = validerNumeroJour(numeroJourNum, credit.dureeJours);
      if (erreurJour) throw new Error("JOUR:" + erreurJour);

      const montantVerse = Number(montant);
      const now = new Date();

      // ── Récupération des échéances à imputer ──────────────────────────────
      const echeances = await tx.echeanceCredit.findMany({
        where: { creditId, statut: { in: [StatutEcheanceCredit.EN_ATTENTE, StatutEcheanceCredit.PARTIEL] } },
        orderBy: { dateEcheance: "asc" },
      });

      let montantRestant = montantVerse;

      // ── Imputation sur les échéances ──────────────────────────────────────
      for (const echeance of echeances) {
        if (montantRestant <= 0) break;

        const restantEcheance = Number(
          (Number(echeance.montantDu) - Number(echeance.montantPaye)).toFixed(2)
        );

        // Calcul de la pénalité (informatif, mis à jour à chaque remboursement)
        let penalite = Number(echeance.penalite);
        if (echeance.dateEcheance < now && Number(credit.tauxPenalite) > 0) {
          const joursRetard = Math.max(
            0,
            Math.floor((now.getTime() - echeance.dateEcheance.getTime()) / (1000 * 60 * 60 * 24))
          );
          penalite = Number(
            (Number(echeance.montantDu) * (Number(credit.tauxPenalite) / 100) * joursRetard).toFixed(2)
          );
        }

        if (montantRestant >= restantEcheance) {
          // Échéance soldée intégralement
          await tx.echeanceCredit.update({
            where: { id: echeance.id },
            data: {
              montantPaye: Number(echeance.montantDu),
              statut: StatutEcheanceCredit.PAYE,
              penalite,
            },
          });
          montantRestant = Number((montantRestant - restantEcheance).toFixed(2));
        } else {
          // Paiement partiel
          await tx.echeanceCredit.update({
            where: { id: echeance.id },
            data: {
              montantPaye: Number((Number(echeance.montantPaye) + montantRestant).toFixed(2)),
              statut: StatutEcheanceCredit.PARTIEL,
              penalite,
            },
          });
          montantRestant = 0;
        }
      }

      // Montant effectivement imputé (le versement ne peut pas dépasser le solde restant)
      const montantEffectif = Number(
        Math.min(montantVerse, Number(credit.soldeRestant)).toFixed(2)
      );

      // ── Création du remboursement ─────────────────────────────────────────
      const montantAttendu = await montantAttenduDuJour(tx, creditId, numeroJourNum);
      const remboursement = await tx.remboursementCredit.create({
        data: {
          creditId,
          montant: montantEffectif,
          modePaiement: (modePaiement as TypePaiement) ?? TypePaiement.ESPECES,
          notes: (observation ?? notes) || null,
          enregistreParId: Number(session.user.id),
          // Agent collecteur = celui indiqué, sinon l'utilisateur qui encaisse
          agentCollecteurId: agentCollecteurId ? parseInt(String(agentCollecteurId)) : Number(session.user.id),
          numeroJour: numeroJourNum,
          montantAttendu,
          dateRemboursement: parseDateCollecte(dateCollecte) ?? new Date(),
          statut: "CONFIRME", // enregistrement direct admin/RVC — effets financiers déjà appliqués
          dateConfirmation: new Date(),
        },
      });

      // ── Mise à jour du crédit ─────────────────────────────────────────────
      const newSoldeRestant     = Number(Math.max(0, Number(credit.soldeRestant) - montantEffectif).toFixed(2));
      const newMontantRembourse = Number((Number(credit.montantRembourse) + montantEffectif).toFixed(2));

      // Déterminer le nouveau statut du crédit
      let newStatut: StatutCredit;
      if (newSoldeRestant <= 0) {
        newStatut = StatutCredit.SOLDE;
        // Marquer les éventuelles échéances résiduelles comme PAYE (arrondi)
        await tx.echeanceCredit.updateMany({
          where: { creditId, statut: { in: [StatutEcheanceCredit.EN_ATTENTE, StatutEcheanceCredit.PARTIEL] } },
          data: { statut: StatutEcheanceCredit.PAYE },
        });
      } else {
        // Y a-t-il encore des échéances en retard non soldées ?
        const echeanceEnRetard = await tx.echeanceCredit.findFirst({
          where: {
            creditId,
            statut: { in: [StatutEcheanceCredit.EN_ATTENTE, StatutEcheanceCredit.PARTIEL] },
            dateEcheance: { lt: now },
          },
        });
        newStatut = echeanceEnRetard ? StatutCredit.EN_RETARD : StatutCredit.ACTIF;
      }

      await tx.creditClient.update({
        where: { id: creditId },
        data: {
          montantRembourse: newMontantRembourse,
          soldeRestant:     newSoldeRestant,
          statut:           newStatut,
        },
      });

      // ── Mise à jour soldeActuel du client ─────────────────────────────────
      await tx.client.update({
        where: { id: credit.clientId },
        data: { soldeActuel: { decrement: montantEffectif } },
      });

      // ── Hook RIA — remboursement proportionnel des financements liés ──────
      const financementsRIA = await tx.operationFinancementRIA.findMany({
        where: { creditClientId: creditId, statut: { in: ["ACTIF", "EN_RETARD"] } },
      });
      if (financementsRIA.length > 0) {
        const totalEncoursRIA = financementsRIA.reduce((s, f) => s + Number(f.encours), 0);
        for (const fin of financementsRIA) {
          if (Number(fin.encours) <= 0) continue;
          const partProportion = totalEncoursRIA > 0 ? Number(fin.encours) / totalEncoursRIA : 0;
          const part = Number(Math.min(montantEffectif * partProportion, Number(fin.encours)).toFixed(2));
          if (part <= 0) continue;
          const newEncours = Number(Math.max(0, Number(fin.encours) - part).toFixed(2));
          await tx.remboursementRIA.create({
            data: { financementId: fin.id, montant: part, remboursementCreditId: remboursement.id },
          });
          await tx.operationFinancementRIA.update({
            where: { id: fin.id },
            data: {
              montantRembourse: { increment: part },
              encours:          newEncours,
              statut:           newEncours <= 0 ? "REMBOURSE" : fin.statut,
            },
          });
          await tx.portefeuilleRIA.update({
            where: { id: fin.portefeuilleId },
            data: {
              capitalEngage:     { decrement: part },
              capitalRecouvre:   { increment: part },
              capitalDisponible: { increment: part },
            },
          });
          await tx.mouvementFondsRIA.create({
            data: {
              type:           "REMBOURSEMENT_CLIENT",
              montant:        part,
              sens:           "CREDIT",
              description:    `Remboursement automatique — crédit ${credit.reference}`,
              reference:      fin.reference,
              portefeuilleId: fin.portefeuilleId,
              financementId:  fin.id,
            },
          });
        }
      }

      // ── Audit log ─────────────────────────────────────────────────────────
      await tx.auditLog.create({
        data: {
          action: "REMBOURSEMENT_CREDIT",
          entite: "CreditClient",
          entiteId: creditId,
          userId: Number(session.user.id),
        },
      });

      // ── Notifications ─────────────────────────────────────────────────────
      const admins = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });
      if (admins.length > 0) {
        const estSolde = newStatut === StatutCredit.SOLDE;
        await tx.notification.createMany({
          data: admins.map((u) => ({
            userId: u.id,
            titre: estSolde ? "Crédit soldé" : "Remboursement enregistré",
            message: estSolde
              ? `Le crédit ${credit.reference} de ${credit.client.prenom} ${credit.client.nom} est intégralement remboursé.`
              : `Remboursement de ${montantEffectif} FCFA sur le crédit ${credit.reference}. Solde restant : ${newSoldeRestant} FCFA.`,
            priorite: estSolde ? PrioriteNotification.HAUTE : PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/admin/credits/${creditId}`,
          })),
        });
      }

      return remboursement;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/admin/credits/[id]/remboursements", error);
    if (error instanceof Error) {
      if (error.message.startsWith("JOUR:")) {
        return NextResponse.json({ message: error.message.slice(5) }, { status: 400 });
      }
      const map: Record<string, [string, number]> = {
        CREDIT_INTROUVABLE:      ["Crédit introuvable", 404],
        CREDIT_NON_REMBOURSABLE: ["Seuls les crédits ACTIF ou EN_RETARD peuvent être remboursés", 422],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ message: msg }, { status });
      }
    }
    return NextResponse.json({ message: "Erreur lors de l'enregistrement du remboursement" }, { status: 500 });
  }
}
