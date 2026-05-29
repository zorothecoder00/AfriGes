import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId, souscriptionPdvWhere } from "@/lib/authCaissier";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

function genRef(): string {
  const d   = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ENC-${ymd}-${rand}`;
}

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

    const nouveauMontantVerse   = Number(souscription.montantVerse) + montantNum;
    const nouveauMontantRestant = Number(souscription.montantTotal) - nouveauMontantVerse;
    const estSolde              = nouveauMontantRestant <= 0.01;

    // Calcul du nouveau statut selon le type de pack
    let nouveauStatut: string;
    if (estSolde) {
      nouveauStatut = "COMPLETE";
    } else if (souscription.pack.type === "REVENDEUR" && souscription.formuleRevendeur === "FORMULE_1") {
      const seuil50 = Number(souscription.montantTotal) * 0.5;
      nouveauStatut = nouveauMontantVerse >= seuil50 ? "ACTIF" : "EN_ATTENTE";
    } else if (souscription.pack.type === "URGENCE" && souscription.pack.acomptePercent) {
      const seuilAcompte = (Number(souscription.montantTotal) * Number(souscription.pack.acomptePercent)) / 100;
      nouveauStatut = nouveauMontantVerse >= seuilAcompte ? "ACTIF" : "EN_ATTENTE";
    } else {
      nouveauStatut = nouveauMontantVerse > 0 ? "ACTIF" : "EN_ATTENTE";
    }

    const nouveauCycle =
      estSolde && souscription.pack.type === "FAMILIAL"
        ? souscription.numeroCycle + 1
        : souscription.numeroCycle;

    const sessionActive = await prisma.sessionCaisse.findFirst({
      where: {
        statut:    { in: ["OUVERTE", "SUSPENDUE"] },
        caissierId: userId,
      },
      orderBy: { createdAt: "desc" },
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Confirmer le versement
      await tx.versementPack.update({
        where: { id: versementId },
        data:  { statut: "PAYE" },
      });

      // 2. Mettre à jour la souscription
      await tx.souscriptionPack.update({
        where: { id: souscription.id },
        data:  {
          montantVerse:   nouveauMontantVerse,
          montantRestant: estSolde ? 0 : nouveauMontantRestant,
          statut:         nouveauStatut as never,
          dateCloture:    estSolde ? new Date() : null,
          numeroCycle:    nouveauCycle,
        },
      });

      // 3. Mettre à jour les échéances
      if (estSolde) {
        await tx.echeancePack.updateMany({
          where: { souscriptionId: souscription.id, statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
          data:  { statut: "PAYE", datePaiement: versement.datePaiement },
        });
      } else {
        const nonPayees = await tx.echeancePack.findMany({
          where:   { souscriptionId: souscription.id, statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
          orderBy: { numero: "asc" },
        });
        const idsAPayer: number[] = [];
        let budget = montantNum;
        for (const ec of nonPayees) {
          if (budget >= Number(ec.montant) - 0.01) {
            idsAPayer.push(ec.id);
            budget -= Number(ec.montant);
          } else break;
        }
        if (idsAPayer.length === 0 && nonPayees.length > 0) idsAPayer.push(nonPayees[0].id);
        if (idsAPayer.length > 0) {
          await tx.echeancePack.updateMany({
            where: { id: { in: idsAPayer } },
            data:  { statut: "PAYE", datePaiement: versement.datePaiement },
          });
        }
      }

      // 4. Créer une OperationCaisse si session active
      if (sessionActive) {
        await tx.operationCaisse.create({
          data: {
            sessionId:    sessionActive.id,
            type:         "ENCAISSEMENT",
            mode:         "ESPECES",
            montant:      new Prisma.Decimal(montantNum),
            motif:        `Versement pack confirmé — ${souscription.pack.nom} (${versement.encaisseParNom})`,
            reference:    genRef(),
            operateurNom: caissierNom,
            operateurId:  userId,
          },
        });
      }

      // 5. Audit + notification
      await auditLog(tx, userId, "VERSEMENT_PACK_CONFIRME", "VersementPack", versementId);

      const clientNom = souscription.client
        ? `${souscription.client.prenom} ${souscription.client.nom}`
        : "—";

      await notifyAdmins(tx, {
        titre:    `Versement confirmé — ${souscription.pack.nom}`,
        message:  `${caissierNom} a confirmé ${montantNum.toLocaleString("fr-FR")} FCFA de ${clientNom} (collecté par ${versement.encaisseParNom}).${estSolde ? " Souscription soldée !" : ""}`,
        priorite: estSolde ? "HAUTE" : "NORMAL",
        actionUrl: "/dashboard/admin/packs",
      });

      // Notifier l'agent terrain
      if (versement.encaisseParId) {
        await tx.notification.create({
          data: {
            userId:    versement.encaisseParId,
            titre:     "Versement confirmé",
            message:   `Votre versement de ${montantNum.toLocaleString("fr-FR")} FCFA (${souscription.pack.nom}) a été confirmé par le caissier.`,
            priorite:  "NORMAL",
            actionUrl: "/dashboard/user/agentsTerrain",
          },
        });
      }

      return { versementId, estSolde };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("POST /api/caissier/versements/[id]/confirmer", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
