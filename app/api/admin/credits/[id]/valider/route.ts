import { NextResponse } from "next/server";
import {
  MemberStatus, NiveauRisque, PrioriteNotification, Role,
  StatutCredit, TypeMouvement, TypeSortieStock,
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

      // ── 10. Décrémentation du stock (lignes avec produitId + PDV connu) ───
      if (credit.pointDeVenteId) {
        const lignesAvecProduit = credit.lignes.filter((l) => l.produitId !== null);
        for (const ligne of lignesAvecProduit) {
          // Décrémente le StockSite (createOrUpdate pour tolérance)
          await tx.stockSite.updateMany({
            where: { produitId: ligne.produitId!, pointDeVenteId: credit.pointDeVenteId },
            data:  { quantite: { decrement: ligne.quantite } },
          });

          // Journal du mouvement
          const dateStr = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
          await tx.mouvementStock.create({
            data: {
              produitId:      ligne.produitId!,
              pointDeVenteId: credit.pointDeVenteId,
              type:           TypeMouvement.SORTIE,
              typeSortie:     TypeSortieStock.VENTE_DIRECTE,
              quantite:       ligne.quantite,
              prixUnitaire:   ligne.prixUnitaire,
              motif:          `Crédit validé — ${credit.reference}`,
              reference:      `MVT-CRD-${creditId}-P${ligne.produitId}-${dateStr}`,
              operateurId:    Number(session.user.id),
            },
          });
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
      const destinataires: { id: number }[] = [];

      // Admins
      const admins = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });
      destinataires.push(...admins);

      // Agent terrain affecté au client (transfert recouvrement)
      if (client.agentTerrainId) {
        const agentDejaPresent = destinataires.some((d) => d.id === client.agentTerrainId);
        if (!agentDejaPresent) destinataires.push({ id: client.agentTerrainId });
      }

      if (destinataires.length > 0) {
        await tx.notification.createMany({
          data: destinataires.map((u) => ({
            userId:    u.id,
            titre:     "Crédit validé — à suivre",
            message:   `Crédit ${credit.reference} (${montantTotal} FCFA) pour ${client.prenom} ${client.nom} validé. ${duree} échéances générées à partir du ${credit.dateDebut.toISOString().slice(0, 10)}.`,
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
