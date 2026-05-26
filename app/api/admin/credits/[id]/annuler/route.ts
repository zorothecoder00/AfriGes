import { NextResponse } from "next/server";
import {
  PrioriteNotification, Role, StatutCredit,
  TypeMouvement, TypeEntreeStock,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

type Ctx = { params: Promise<{ id: string }> };

/**
 * ==========================
 * POST /api/admin/credits/[id]/annuler
 * ==========================
 * Annule ou rejette un crédit.
 *
 * Body: { action: "ANNULE" | "REJETE", motif? }
 *
 * - EN_ATTENTE_VALIDATION → ANNULE ou REJETE (pas de mouvement sur soldeActuel)
 * - ACTIF / EN_RETARD     → ANNULE (inverse client.soldeActuel du soldeRestant)
 * - VALIDE / SOLDE        → non annulable
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const action: "ANNULE" | "REJETE" = body.action ?? "ANNULE";
    const motif: string | undefined = body.motif;

    if (!["ANNULE", "REJETE"].includes(action)) {
      return NextResponse.json({ message: "Action invalide (ANNULE ou REJETE)" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const credit = await tx.creditClient.findUnique({
        where: { id: creditId },
        include: {
          client: { select: { id: true, nom: true, prenom: true } },
          lignes: {
            select: { id: true, produitId: true, produitNom: true, quantite: true, prixUnitaire: true },
          },
        },
      });
      if (!credit) throw new Error("CREDIT_INTROUVABLE");

      const annulables = [
        StatutCredit.EN_ATTENTE_VALIDATION,
        StatutCredit.ACTIF,
        StatutCredit.EN_RETARD,
      ];
      if (!(annulables as StatutCredit[]).includes(credit.statut)) throw new Error("CREDIT_NON_ANNULABLE");

      // REJETE uniquement possible depuis EN_ATTENTE_VALIDATION
      if (action === "REJETE" && credit.statut !== StatutCredit.EN_ATTENTE_VALIDATION) {
        throw new Error("REJET_IMPOSSIBLE");
      }

      // ── Inversion du soldeActuel si le crédit était déjà ACTIF/EN_RETARD ─
      const creditActif =
        credit.statut === StatutCredit.ACTIF ||
        credit.statut === StatutCredit.EN_RETARD;

      if (creditActif && Number(credit.soldeRestant) > 0) {
        await tx.client.update({
          where: { id: credit.clientId },
          data: { soldeActuel: { decrement: Number(credit.soldeRestant) } },
        });

        // ── Restauration du stock (lignes avec produitId + PDV connu) ──────
        if (credit.pointDeVenteId) {
          const lignesAvecProduit = credit.lignes.filter((l) => l.produitId !== null);
          for (const ligne of lignesAvecProduit) {
            await tx.stockSite.updateMany({
              where: { produitId: ligne.produitId!, pointDeVenteId: credit.pointDeVenteId! },
              data:  { quantite: { increment: ligne.quantite } },
            });

            const dateStr = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
            await tx.mouvementStock.create({
              data: {
                produitId:      ligne.produitId!,
                pointDeVenteId: credit.pointDeVenteId!,
                type:           TypeMouvement.ENTREE,
                typeEntree:     TypeEntreeStock.RETOUR_CLIENT,
                quantite:       ligne.quantite,
                prixUnitaire:   ligne.prixUnitaire,
                motif:          `Annulation crédit — ${credit.reference}`,
                reference:      `MVT-ANN-${creditId}-P${ligne.produitId}-${dateStr}`,
                operateurId:    Number(session.user.id),
              },
            });
          }
        }
      }

      // ── Supprimer les échéances non payées ────────────────────────────────
      await tx.echeanceCredit.deleteMany({
        where: { creditId, statut: { in: ["EN_ATTENTE", "PARTIEL"] } },
      });

      const newStatut = action === "REJETE" ? StatutCredit.REJETE : StatutCredit.ANNULE;

      const updated = await tx.creditClient.update({
        where: { id: creditId },
        data: {
          statut: newStatut,
          ...(motif && { observations: motif }),
        },
      });

      await tx.auditLog.create({
        data: {
          action:   action === "REJETE" ? "REJET_CREDIT" : "ANNULATION_CREDIT",
          entite:   "CreditClient",
          entiteId: creditId,
          userId:   Number(session.user.id),
        },
      });

      // ── Notifications : admins + créateur du crédit ───────────────────────
      const destinataires = new Map<number, true>();

      const admins = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });
      admins.forEach((u) => destinataires.set(u.id, true));

      // Notifier le créateur (peut ne pas être admin)
      if (credit.creeParId) destinataires.set(credit.creeParId, true);

      if (destinataires.size > 0) {
        const titre   = action === "REJETE" ? "Crédit rejeté" : "Crédit annulé";
        const message = `Le crédit ${credit.reference} de ${credit.client.prenom} ${credit.client.nom} a été ${action === "REJETE" ? "rejeté" : "annulé"}${motif ? ` : ${motif}` : ""}.`;
        await tx.notification.createMany({
          data: [...destinataires.keys()].map((userId) => ({
            userId,
            titre,
            message,
            priorite:  PrioriteNotification.HAUTE,
            actionUrl: `/dashboard/admin/credits/${creditId}`,
          })),
        });
      }

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    console.error("POST /api/admin/credits/[id]/annuler", error);
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CREDIT_INTROUVABLE:  ["Crédit introuvable", 404],
        CREDIT_NON_ANNULABLE: ["Ce crédit ne peut pas être annulé (statut incompatible)", 422],
        REJET_IMPOSSIBLE:    ["Le rejet n'est possible que depuis EN_ATTENTE_VALIDATION", 422],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ message: msg }, { status });
      }
    }
    return NextResponse.json({ message: "Erreur lors de l'annulation du crédit" }, { status: 500 });
  }
}
