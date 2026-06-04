import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/rvc/credits/[id]/refuser
 *
 * Le RVC refuse une demande de crédit EN_ATTENTE_VALIDATION.
 * Body: { motif?: string }
 * - Statut → ANNULE
 * - Notifie le créateur (agent terrain ou autre) et les admins
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId  = parseInt(session.user.id);
    const rvcNom  = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();
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

    const body = await req.json().catch(() => ({})) as { motif?: string };
    const motif = body.motif?.trim() || null;

    const result = await prisma.$transaction(async (tx) => {
      const credit = await tx.creditClient.findUnique({
        where: { id: creditId },
        select: {
          id: true,
          reference: true,
          statut: true,
          pointDeVenteId: true,
          creeParId: true,
          client: { select: { nom: true, prenom: true } },
        },
      });
      if (!credit) throw new Error("CREDIT_INTROUVABLE");
      if (credit.statut !== "EN_ATTENTE_VALIDATION") throw new Error("CREDIT_NON_REFUSABLE");
      if (rvcPdvId !== null && credit.pointDeVenteId !== rvcPdvId) throw new Error("ACCES_REFUSE");

      const updated = await tx.creditClient.update({
        where: { id: creditId },
        data: {
          statut:      "ANNULE",
          observations: motif
            ? `Refusé par ${rvcNom} : ${motif}`
            : `Refusé par ${rvcNom}`,
        },
      });

      await auditLog(tx, userId, "CREDIT_REFUSE_RVC", "CreditClient", creditId);

      const msg = motif
        ? `Votre demande de crédit ${credit.reference} pour ${credit.client.prenom} ${credit.client.nom} a été refusée par ${rvcNom}. Motif : ${motif}.`
        : `Votre demande de crédit ${credit.reference} pour ${credit.client.prenom} ${credit.client.nom} a été refusée par ${rvcNom}.`;

      // Notifier le créateur de la demande
      if (credit.creeParId && credit.creeParId !== userId) {
        await tx.notification.create({
          data: {
            userId:    credit.creeParId,
            titre:     `Demande crédit refusée — ${credit.reference}`,
            message:   msg,
            priorite:  "HAUTE",
            actionUrl: `/dashboard/user/agentsTerrain/ventes-credit`,
          },
        });
      }

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CREDIT_INTROUVABLE:   ["Crédit introuvable", 404],
        CREDIT_NON_REFUSABLE: ["Seuls les crédits EN_ATTENTE_VALIDATION peuvent être refusés", 422],
        ACCES_REFUSE:         ["Accès refusé — PDV non autorisé", 403],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ error: msg }, { status });
      }
    }
    console.error("POST /api/rvc/credits/[id]/refuser", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
