import { NextResponse } from "next/server";
import { PrioriteNotification, Role, StatutCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

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
    const session = await getAdminSession();
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
        include: { client: { select: { id: true, nom: true, prenom: true } } },
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
      }

      // ── Marquer toutes les échéances non payées comme annulées ───────────
      // (on utilise EN_ATTENTE → on les supprime proprement ; les PAYE restent pour l'historique)
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
          action: action === "REJETE" ? "REJET_CREDIT" : "ANNULATION_CREDIT",
          entite: "CreditClient",
          entiteId: creditId,
          userId: Number(session.user.id),
        },
      });

      const admins = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });
      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((u) => ({
            userId: u.id,
            titre: action === "REJETE" ? "Crédit rejeté" : "Crédit annulé",
            message: `Le crédit ${credit.reference} de ${credit.client.prenom} ${credit.client.nom} a été ${action === "REJETE" ? "rejeté" : "annulé"}${motif ? ` : ${motif}` : ""}.`,
            priorite: PrioriteNotification.HAUTE,
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
