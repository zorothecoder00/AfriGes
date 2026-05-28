import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getAuthSession } from "@/lib/auth";
import { notifyAdmins, notify, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

async function getSession() {
  const logistique = await getLogistiqueSession();
  if (logistique) return logistique;
  const admin = await getAuthSession();
  if (admin && (admin.user.role === "ADMIN" || admin.user.role === "SUPER_ADMIN")) return admin;
  return null;
}

/**
 * PATCH /api/logistique/ajustements/[id]
 * Pré-validation niveau 2 par le Responsable Approvisionnement.
 *
 * Actions :
 * - "VALIDER"  → EN_ATTENTE → PRE_VALIDEE + notifie Admin pour approbation finale
 * - "REJETER"  → EN_ATTENTE → REJETE      + notifie Magasinier avec motif
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const demandeId = Number(id);
    if (isNaN(demandeId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { action, commentaire } = body;

    if (!["VALIDER", "REJETER"].includes(action)) {
      return NextResponse.json({ error: "Action invalide : VALIDER ou REJETER" }, { status: 400 });
    }

    const demande = await prisma.demandeAjustementStock.findUnique({
      where: { id: demandeId },
      include: {
        produit:      { select: { id: true, nom: true } },
        pointDeVente: { select: { id: true, nom: true } },
        demandeur:    { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (!demande) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

    if (demande.statut !== "EN_ATTENTE") {
      return NextResponse.json(
        { error: `Impossible de traiter : statut actuel "${demande.statut}" (attendu : EN_ATTENTE)` },
        { status: 400 }
      );
    }

    const operateur = `${session.user.prenom} ${session.user.nom}`;
    const diff = demande.nouvelleQuantite - demande.ancienneQuantite;
    const operateurId = parseInt(session.user.id);

    const updated = await prisma.$transaction(async (tx) => {
      if (action === "VALIDER") {
        const d = await tx.demandeAjustementStock.update({
          where: { id: demandeId },
          data: {
            statut:               "PRE_VALIDEE",
            validateurId:         operateurId,
            commentaireValidation: commentaire?.trim() || null,
          },
        });

        await auditLog(tx, operateurId, "AJUSTEMENT_PRE_VALIDE_LOGISTIQUE", "DemandeAjustementStock", demandeId);

        // Notifier Admin pour approbation finale (niveau 3)
        await notifyAdmins(tx, {
          titre:    `Ajustement inventaire à approuver — ${demande.produit.nom}`,
          message:  `${operateur} (Resp. Appro) a pré-validé la demande d'ajustement de "${demande.produit.nom}" (${demande.pointDeVente.nom}) : ${demande.ancienneQuantite} → ${demande.nouvelleQuantite} (${diff > 0 ? "+" : ""}${diff}). Approuvez pour appliquer au stock.`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: "/dashboard/admin/stock/ajustements",
        });

        return d;
      } else {
        // REJETER directement
        const d = await tx.demandeAjustementStock.update({
          where: { id: demandeId },
          data: {
            statut:               "REJETE",
            validateurId:         operateurId,
            commentaireValidation: commentaire?.trim() || `Rejeté par ${operateur} (Resp. Appro)`,
          },
        });

        await auditLog(tx, operateurId, "AJUSTEMENT_REJETE_LOGISTIQUE", "DemandeAjustementStock", demandeId);

        // Notifier le magasinier du rejet
        await notify(tx, [demande.demandeurId], {
          titre:    `Ajustement inventaire rejeté — ${demande.produit.nom}`,
          message:  `${operateur} (Resp. Appro) a rejeté votre demande d'ajustement pour "${demande.produit.nom}" (${demande.pointDeVente.nom}).${commentaire ? ` Motif : ${commentaire.trim()}` : ""}`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: "/dashboard/user/magasiniers",
        });

        return d;
      }
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /logistique/ajustements/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
