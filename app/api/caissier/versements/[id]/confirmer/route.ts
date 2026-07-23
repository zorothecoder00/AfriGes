import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId, souscriptionPdvWhere } from "@/lib/authCaissier";
import { notifyAdmins, auditLog } from "@/lib/notifications";
import { confirmerVersementPackExistant } from "@/lib/versementPack";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/caissier/versements/[id]/confirmer
 * Confirme ou rejette un VersementPack EN_ATTENTE collecté par un agent terrain.
 * Body: { action: "CONFIRMER" | "REJETER", notes? }
 *
 * CONFIRMER → statut PAYE + effet financier (souscription + échéances + OperationCaisse)
 * REJETER   → statut ANNULE
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const versementId = parseInt(id);
    if (isNaN(versementId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { action, notes } = body as { action: string; notes?: string };

    if (!["CONFIRMER", "REJETER"].includes(action)) {
      return NextResponse.json({ error: "action doit être CONFIRMER ou REJETER" }, { status: 400 });
    }

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);
    const caissierNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    // Vérifier que le versement appartient au périmètre du caissier
    const versement = await prisma.versementPack.findFirst({
      where: {
        id: versementId,
        statut: "EN_ATTENTE",
        ...(pdvId ? { souscription: souscriptionPdvWhere(pdvId) } : {}),
      },
      include: {
        souscription: {
          include: {
            pack:   true,
            client: { select: { nom: true, prenom: true } },
          },
        },
      },
    });

    if (!versement) {
      return NextResponse.json(
        { error: "Versement EN_ATTENTE introuvable ou hors périmètre" },
        { status: 404 }
      );
    }

    const souscription = versement.souscription;
    const montantNum   = Number(versement.montant);

    // ── REJET ──────────────────────────────────────────────────────────────────
    if (action === "REJETER") {
      await prisma.$transaction(async (tx) => {
        await tx.versementPack.update({
          where: { id: versementId },
          data:  { statut: "ANNULE", notes: notes ? `[Rejeté] ${notes}` : "[Rejeté par caissier]" },
        });

        await auditLog(tx, userId, "VERSEMENT_PACK_REJETE", "VersementPack", versementId);

        // Notifier l'agent qui avait collecté
        if (versement.encaisseParId) {
          await tx.notification.create({
            data: {
              userId:    versement.encaisseParId,
              titre:     "Versement rejeté",
              message:   `Votre versement de ${montantNum.toLocaleString("fr-FR")} FCFA (${souscription.pack.nom}) a été rejeté par le caissier.${notes ? ` Motif : ${notes}` : ""}`,
              priorite:  "HAUTE",
              actionUrl: "/dashboard/user/agentsTerrain",
            },
          });
        }
      });

      return NextResponse.json({ success: true, message: "Versement rejeté" });
    }

    // ── CONFIRMATION ───────────────────────────────────────────────────────────
    // Vérifier que la souscription est encore active
    if (["ANNULE", "COMPLETE"].includes(souscription.statut)) {
      return NextResponse.json(
        { error: `Souscription déjà ${souscription.statut.toLowerCase()}, impossible de confirmer` },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const out = await confirmerVersementPackExistant(tx, versementId, userId, caissierNom);
      if (!out.ok) throw Object.assign(new Error(out.error), { status: 400 });

      await auditLog(tx, userId, "VERSEMENT_PACK_CONFIRME", "VersementPack", versementId);

      const clientNom = souscription.client
        ? `${souscription.client.prenom} ${souscription.client.nom}`
        : "—";

      await notifyAdmins(tx, {
        titre:    `Versement confirmé — ${souscription.pack.nom}`,
        message:  `${caissierNom} a confirmé ${out.montantEffectif.toLocaleString("fr-FR")} FCFA de ${clientNom} (collecté par ${versement.encaisseParNom}).${out.estSolde ? " Souscription soldée !" : ""}`,
        priorite: out.estSolde ? "HAUTE" : "NORMAL",
        actionUrl: "/dashboard/admin/packs",
      });

      // Notifier l'agent terrain
      if (versement.encaisseParId) {
        await tx.notification.create({
          data: {
            userId:    versement.encaisseParId,
            titre:     "Versement confirmé",
            message:   `Votre versement de ${out.montantEffectif.toLocaleString("fr-FR")} FCFA (${souscription.pack.nom}) a été confirmé par le caissier.`,
            priorite:  "NORMAL",
            actionUrl: "/dashboard/user/agentsTerrain",
          },
        });
      }

      return { versementId, estSolde: out.estSolde };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    if (status === 500) console.error("POST /api/caissier/versements/[id]/confirmer", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status });
  }
}
