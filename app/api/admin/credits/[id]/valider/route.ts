import { NextResponse } from "next/server";
import { MemberStatus, NiveauRisque, PrioriteNotification, Role, StatutCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * ==========================
 * POST /api/admin/credits/[id]/valider
 * ==========================
 * Valide un crédit EN_ATTENTE_VALIDATION :
 *  1. Génère les EcheanceCredit journalières
 *  2. Met à jour client.soldeActuel += montantTotal
 *  3. Passe le statut à ACTIF
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
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
              etat: true, niveauRisque: true,
              limiteCredit: true, soldeActuel: true,
            },
          },
        },
      });
      if (!credit) throw new Error("CREDIT_INTROUVABLE");
      if (credit.statut !== StatutCredit.EN_ATTENTE_VALIDATION) throw new Error("CREDIT_DEJA_TRAITE");

      // ── Re-vérification des règles d'éligibilité au moment de la validation ──
      const client = credit.client;
      if (client.etat !== MemberStatus.ACTIF) throw new Error("CLIENT_INACTIF");

      if (client.limiteCredit !== null && client.soldeActuel !== null) {
        const soldeApres = Number(client.soldeActuel) + Number(credit.montantTotal);
        if (soldeApres > Number(client.limiteCredit)) {
          throw new Error("LIMITE_CREDIT_DEPASSEE");
        }
      }

      if (client.niveauRisque === NiveauRisque.CRITIQUE) {
        const creditEnRetard = await tx.creditClient.findFirst({
          where: { clientId: client.id, statut: StatutCredit.EN_RETARD, id: { not: creditId } },
          select: { id: true },
        });
        if (creditEnRetard) throw new Error("CLIENT_CRITIQUE_EN_RETARD");
      }

      // ── Calcul du montant journalier exact ────────────────────────────────
      const montantTotal     = Number(credit.montantTotal);
      const duree            = credit.dureeJours;
      const montantJournalier = Number((montantTotal / duree).toFixed(2));

      // Arrondi résiduel affecté à la dernière échéance pour que la somme = montantTotal
      const totalCalculated = Number((montantJournalier * duree).toFixed(2));
      const residuel         = Number((montantTotal - totalCalculated).toFixed(2));

      const dateEcheanceFin = new Date(credit.dateDebut);
      dateEcheanceFin.setDate(dateEcheanceFin.getDate() + duree);

      // ── Génération des échéances journalières ────────────────────────────
      const echeancesData: {
        creditId: number;
        numeroEcheance: number;
        dateEcheance: Date;
        montantDu: number;
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

      // ── Mise à jour du crédit ─────────────────────────────────────────────
      const updated = await tx.creditClient.update({
        where: { id: creditId },
        data: {
          statut: StatutCredit.ACTIF,
          montantJournalier,
          dateEcheanceFin,
          valideParId:   Number(session.user.id),
          dateValidation: new Date(),
        },
      });

      // ── Mise à jour soldeActuel du client ─────────────────────────────────
      await tx.client.update({
        where: { id: credit.clientId },
        data: { soldeActuel: { increment: montantTotal } },
      });

      // ── Audit log ─────────────────────────────────────────────────────────
      await tx.auditLog.create({
        data: {
          action: "VALIDATION_CREDIT",
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
        await tx.notification.createMany({
          data: admins.map((u) => ({
            userId: u.id,
            titre: "Crédit validé",
            message: `Le crédit ${credit.reference} (${montantTotal} FCFA) pour ${credit.client.prenom} ${credit.client.nom} a été validé. ${duree} échéances générées.`,
            priorite: PrioriteNotification.HAUTE,
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
        CREDIT_INTROUVABLE:        ["Crédit introuvable", 404],
        CREDIT_DEJA_TRAITE:        ["Seuls les crédits EN_ATTENTE_VALIDATION peuvent être validés", 422],
        CLIENT_INACTIF:            ["Ce client n'est plus actif — validation impossible", 422],
        LIMITE_CREDIT_DEPASSEE:    ["Ce crédit dépasse le plafond autorisé pour ce client — modifiez le montant ou augmentez le plafond", 422],
        CLIENT_CRITIQUE_EN_RETARD: ["Client en risque CRITIQUE avec un crédit en retard — validation impossible", 422],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ message: msg }, { status });
      }
    }
    return NextResponse.json({ message: "Erreur lors de la validation du crédit" }, { status: 500 });
  }
}
