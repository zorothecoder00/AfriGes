import { NextResponse } from "next/server";
import {
  MemberStatus, NiveauRisque, PrioriteNotification, Role, StatutCredit,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

type Ctx = { params: Promise<{ id: string }> };

/**
 * ==========================
 * POST /api/admin/credits/[id]/valider
 * ==========================
 * Valide un crédit EN_ATTENTE_VALIDATION :
 *  1. Re-vérifie l'éligibilité (plafond, dettes, score, niveau risque)
 *  2. Génère les EcheanceCredit journalières
 *  3. Met à jour client.soldeActuel += montantTotal
 *  4. Décrémente le stock des lignes (si produitId + pointDeVenteId)
 *  5. Notifie les admins + l'agent terrain affecté au client
 *  6. Passe le statut à ACTIF
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const credit = await tx.creditClient.findUnique({
        where: { id: creditId },
        include: {
          client: {
            select: {
              id: true, nom: true, prenom: true,
              etat: true, niveauRisque: true, scoreSolvabilite: true,
              limiteCredit: true, soldeActuel: true,
              agentTerrainId: true,
            },
          },
          lignes: {
            select: { id: true, produitId: true, produitNom: true, quantite: true, prixUnitaire: true },
          },
        },
      });
      if (!credit) throw new Error("CREDIT_INTROUVABLE");
      if (credit.statut !== StatutCredit.EN_ATTENTE_VALIDATION) throw new Error("CREDIT_DEJA_TRAITE");

      const client = credit.client;

      // ── 1. Client actif ───────────────────────────────────────────────────
      if (client.etat !== MemberStatus.ACTIF) throw new Error("CLIENT_INACTIF");

      // ── 2. Plafond crédit ─────────────────────────────────────────────────
      if (client.limiteCredit !== null && client.soldeActuel !== null) {
        const soldeApres = Number(client.soldeActuel) + Number(credit.montantTotal);
        if (soldeApres > Number(client.limiteCredit)) throw new Error("LIMITE_CREDIT_DEPASSEE");
      }

      // ── 3. Vérification des dettes : tout client avec un crédit EN_RETARD ─
      const creditEnRetard = await tx.creditClient.findFirst({
        where: { clientId: client.id, statut: StatutCredit.EN_RETARD, id: { not: creditId } },
        select: { id: true, reference: true },
      });
      if (creditEnRetard) throw new Error("CLIENT_EN_RETARD");

      // ── 4. Score de solvabilité ───────────────────────────────────────────
      const score = client.scoreSolvabilite ?? 100;
      if (score < 20) throw new Error("SCORE_INSUFFISANT");

      // ── 5. Règles par niveau de risque ───────────────────────────────────
      if (client.niveauRisque === NiveauRisque.CRITIQUE) {
        throw new Error("CLIENT_RISQUE_CRITIQUE");
      }
      if (client.niveauRisque === NiveauRisque.ELEVE && score < 40) {
        throw new Error("CLIENT_RISQUE_ELEVE_SCORE_FAIBLE");
      }

      // ── 6. Calcul du montant journalier exact ─────────────────────────────
      const montantTotal      = Number(credit.montantTotal);
      const duree             = credit.dureeJours;
      const montantJournalier = Number((montantTotal / duree).toFixed(2));
      const totalCalculated   = Number((montantJournalier * duree).toFixed(2));
      const residuel          = Number((montantTotal - totalCalculated).toFixed(2));

      const dateEcheanceFin = new Date(credit.dateDebut);
      dateEcheanceFin.setDate(dateEcheanceFin.getDate() + duree);

      // ── 7. Génération des échéances journalières ──────────────────────────
      const echeancesData: {
        creditId: number; numeroEcheance: number;
        dateEcheance: Date; montantDu: number;
      }[] = [];

      for (let i = 1; i <= duree; i++) {
        const dateEcheance = new Date(credit.dateDebut);
        dateEcheance.setDate(dateEcheance.getDate() + (i - 1));
        const montantDu = i === duree
          ? Number((montantJournalier + residuel).toFixed(2))
          : montantJournalier;
        echeancesData.push({ creditId, numeroEcheance: i, dateEcheance, montantDu });
      }
      await tx.echeanceCredit.createMany({ data: echeancesData });

      // ── 8. Mise à jour du crédit ──────────────────────────────────────────
      const updated = await tx.creditClient.update({
        where: { id: creditId },
        data: {
          statut: StatutCredit.ACTIF,
          montantJournalier,
          dateEcheanceFin,
          valideParId:    Number(session.user.id),
          dateValidation: new Date(),
        },
      });

      // ── 9. Mise à jour soldeActuel du client ──────────────────────────────
      await tx.client.update({
        where: { id: credit.clientId },
        data: { soldeActuel: { increment: montantTotal } },
      });

      // ── 9b. Hook RIA — pour chaque affectation active du client ──────────
      const affectationsRIA = await tx.affectationClientRIA.findMany({
        where: { clientId: credit.clientId, actif: true },
        include: { portefeuille: { select: { id: true, capitalDisponible: true } } },
      });

      for (const aff of affectationsRIA) {
        const montantPart = montantTotal * (Number(aff.pourcentage) / 100);
        if (montantPart <= 0) continue;

        // Vérifier capital disponible suffisant
        if (Number(aff.portefeuille.capitalDisponible) < montantPart) continue;

        const ref = `FIN-RIA-${Date.now()}-${aff.id}`;

        await tx.operationFinancementRIA.create({
          data: {
            reference:       ref,
            portefeuilleId:  aff.portefeuilleId,
            affectationId:   aff.id,
            clientId:        credit.clientId,
            creditClientId:  creditId,
            montantFinance:  montantPart,
            montantRembourse: 0,
            encours:         montantPart,
            statut:          "ACTIF",
            dateFinancement: new Date(),
            dateEcheance:    dateEcheanceFin,
          },
        });

        await tx.portefeuilleRIA.update({
          where: { id: aff.portefeuilleId },
          data: {
            capitalDisponible: { decrement: montantPart },
            capitalEngage:     { increment: montantPart },
          },
        });

        await tx.mouvementFondsRIA.create({
          data: {
            portefeuilleId: aff.portefeuilleId,
            type:           "FINANCEMENT_CLIENT",
            sens:           "DEBIT",
            montant:        montantPart,
            description:    `Financement crédit ${credit.reference} — client ${client.prenom} ${client.nom}`,
            reference:      ref,
          },
        });
      }

      // ── 10. Réservation de stock (quantiteReservee) ───────────────────────
      if (credit.pointDeVenteId) {
        for (const ligne of credit.lignes) {
          if (!ligne.produitId) continue;
          await tx.stockSite.upsert({
            where: {
              produitId_pointDeVenteId: {
                produitId:      ligne.produitId,
                pointDeVenteId: credit.pointDeVenteId,
              },
            },
            update: { quantiteReservee: { increment: ligne.quantite } },
            create: {
              produitId:        ligne.produitId,
              pointDeVenteId:   credit.pointDeVenteId,
              quantite:         0,
              quantiteReservee: ligne.quantite,
            },
          });
        }

        // Notifier le magasinier du PDV
        const produitLignes = credit.lignes.filter((l) => l.produitId);
        if (produitLignes.length > 0) {
          const magasiniers = await tx.gestionnaireAffectation.findMany({
            where: {
              pointDeVenteId: credit.pointDeVenteId,
              actif:          true,
              user: { gestionnaire: { role: "MAGAZINIER", actif: true } },
            },
            select: { userId: true },
          });
          if (magasiniers.length > 0) {
            await tx.notification.createMany({
              data: magasiniers.map((m) => ({
                userId:    m.userId,
                titre:     `Livraison requise — crédit ${credit.reference}`,
                message:   `Crédit ${credit.reference} validé pour ${client.prenom} ${client.nom}. ${produitLignes.length} produit(s) à livrer au client.`,
                priorite:  PrioriteNotification.HAUTE,
                actionUrl: `/dashboard/user/magasiniers/ventes-credit`,  // livraisons crédit Flow A
              })),
            });
          }
        }
      }

      // ── 11. Audit log ─────────────────────────────────────────────────────
      await tx.auditLog.create({
        data: {
          action:   "VALIDATION_CREDIT",
          entite:   "CreditClient",
          entiteId: creditId,
          userId:   Number(session.user.id),
        },
      });

      // ── 12. Notifications ─────────────────────────────────────────────────
      const destSet = new Map<number, true>();

      // Admins
      const admins = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });
      admins.forEach((u) => destSet.set(u.id, true));

      // Agent terrain affecté au client (recouvrement terrain)
      if (client.agentTerrainId) destSet.set(client.agentTerrainId, true);

      // Gestionnaires du PDV (RVC, RPV, chef d'agence…)
      if (credit.pointDeVenteId) {
        const pdvGest = await tx.gestionnaireAffectation.findMany({
          where: { pointDeVenteId: credit.pointDeVenteId, actif: true },
          select: { userId: true },
        });
        pdvGest.forEach((g) => destSet.set(g.userId, true));
      }

      if (destSet.size > 0) {
        await tx.notification.createMany({
          data: [...destSet.keys()].map((userId) => ({
            userId,
            titre:     "Crédit validé — à suivre",
            message:   `Crédit ${credit.reference} (${montantTotal.toLocaleString("fr-FR")} FCFA) pour ${client.prenom} ${client.nom} validé. ${duree} échéances générées à partir du ${credit.dateDebut.toISOString().slice(0, 10)}.`,
            priorite:  PrioriteNotification.HAUTE,
            actionUrl: `/dashboard/admin/credits/${creditId}`,
          })),
        });
      }

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    console.error("POST /api/admin/credits/[id]/valider", error);
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CREDIT_INTROUVABLE:             ["Crédit introuvable", 404],
        CREDIT_DEJA_TRAITE:             ["Seuls les crédits EN_ATTENTE_VALIDATION peuvent être validés", 422],
        CLIENT_INACTIF:                 ["Ce client n'est plus actif — validation impossible", 422],
        LIMITE_CREDIT_DEPASSEE:         ["Ce crédit dépasse le plafond autorisé pour ce client", 422],
        CLIENT_EN_RETARD:               ["Ce client a déjà un crédit en retard — remboursement requis avant toute nouvelle validation", 422],
        SCORE_INSUFFISANT:              ["Score de solvabilité insuffisant (< 20) — validation impossible", 422],
        CLIENT_RISQUE_CRITIQUE:         ["Client classé CRITIQUE — validation automatique bloquée, intervention manuelle requise", 422],
        CLIENT_RISQUE_ELEVE_SCORE_FAIBLE: ["Client ÉLEVÉ avec score < 40 — risque trop élevé pour validation", 422],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ message: msg }, { status });
      }
    }
    return NextResponse.json({ message: "Erreur lors de la validation du crédit" }, { status: 500 });
  }
}
