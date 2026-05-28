import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getAuthSession } from "@/lib/auth";
import { notifyRoles, notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

async function getSession() {
  const logistique = await getLogistiqueSession();
  if (logistique) return logistique;
  const admin = await getAuthSession();
  if (admin && (admin.user.role === "ADMIN" || admin.user.role === "SUPER_ADMIN")) return admin;
  return null;
}

/**
 * PATCH /api/logistique/anomalies/[id]
 * Validation niveau 1 par le Responsable Approvisionnement.
 *
 * Actions :
 * - "VALIDER"  → EN_ATTENTE → TRANSMISE + notify admin pour validation financière
 * - "REJETER"  → EN_ATTENTE → EN_COURS  + notify magasinier avec motif
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const anomalieId = Number(id);
    if (isNaN(anomalieId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { action, motif } = body;

    if (!["VALIDER", "REJETER"].includes(action)) {
      return NextResponse.json({ error: "Action invalide. Valeurs : VALIDER, REJETER" }, { status: 400 });
    }

    const anomalie = await prisma.anomalieStock.findUnique({
      where: { id: anomalieId },
      include: {
        produit:      { select: { nom: true } },
        pointDeVente: { select: { nom: true } },
        magasinier:   { select: { id: true, nom: true, prenom: true } },
      },
    });
    if (!anomalie) return NextResponse.json({ error: "Anomalie introuvable" }, { status: 404 });

    if (anomalie.statut !== "EN_ATTENTE") {
      return NextResponse.json(
        { error: `Impossible de traiter : statut actuel "${anomalie.statut}" (attendu : EN_ATTENTE)` },
        { status: 400 }
      );
    }

    const typeLabel: Record<string, string> = {
      MANQUANT: "Manquant", SURPLUS: "Surplus", DEFECTUEUX: "Défectueux",
      PERTE: "Perte", CASSE: "Casse", VOL: "Vol",
    };
    const operateur = `${session.user.prenom} ${session.user.nom}`;

    const updated = await prisma.$transaction(async (tx) => {
      if (action === "VALIDER") {
        // Niveau 1 validé → TRANSMISE (en attente Admin pour impact financier)
        const a = await tx.anomalieStock.update({
          where: { id: anomalieId },
          data: {
            statut:      "TRANSMISE",
            traitePar:   parseInt(session.user.id),
            commentaire: motif || null,
          },
        });

        await auditLog(tx, parseInt(session.user.id), "ANOMALIE_VALIDEE_LOGISTIQUE", "AnomalieStock", anomalieId);

        // Notifier l'admin (validation niveau 2 — impact financier)
        await notifyAdmins(tx, {
          titre:    `Perte/Casse/Vol à approuver — ${anomalie.produit.nom}`,
          message:  `${operateur} (Resp. Appro) a validé la déclaration de ${typeLabel[anomalie.type].toLowerCase()} : ${anomalie.quantite} unité(s) de "${anomalie.produit.nom}" (PDV : ${anomalie.pointDeVente?.nom ?? "—"}). Approuvez l'impact financier pour décrémenter le stock.`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl:`/dashboard/admin/stock`,
        });

        return a;
      } else {
        // Rejeté → EN_COURS (retour au magasinier pour correction)
        const a = await tx.anomalieStock.update({
          where: { id: anomalieId },
          data: {
            statut:      "EN_COURS",
            traitePar:   parseInt(session.user.id),
            commentaire: motif || "Rejeté par le Responsable Approvisionnement",
          },
        });

        await auditLog(tx, parseInt(session.user.id), "ANOMALIE_REJETEE_LOGISTIQUE", "AnomalieStock", anomalieId);

        // Notifier le magasinier du rejet
        await tx.notification.create({
          data: {
            userId:    anomalie.magasinier.id,
            titre:     `Déclaration rejetée — ${anomalie.produit.nom}`,
            message:   `${operateur} a rejeté votre déclaration de ${typeLabel[anomalie.type].toLowerCase()} sur "${anomalie.produit.nom}".${motif ? ` Motif : ${motif}` : ""}`,
            priorite:  PrioriteNotification.HAUTE,
            actionUrl: `/dashboard/user/magasiniers`,
          },
        });

        return a;
      }
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /logistique/anomalies/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
