import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { notifyRoles, auditLog } from "@/lib/notifications";
import { randomUUID } from "crypto";

type Ctx = { params: Promise<{ id: string }> };

async function getAdminSession() {
  const s = await getAuthSession();
  if (!s || !["ADMIN", "SUPER_ADMIN"].includes(s.user.role ?? "")) return null;
  return s;
}

/**
 * PATCH /api/admin/anomalies/[id]
 * Validation niveau 2 par l'Admin Principal.
 *
 * Actions :
 * - "APPROUVER" → TRANSMISE → TRAITEE
 *     + stock_disponible -= quantite
 *     + MouvementStock SORTIE (PERTE | CASSE | VOL)
 *     + quantiteEndommagee += quantite si CASSE ou DEFECTUEUX
 *
 * - "REJETER"   → TRANSMISE → EN_ATTENTE (renvoi au Responsable Appro)
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const anomalieId = Number(id);
    if (isNaN(anomalieId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { action, motif } = body;

    if (!["APPROUVER", "REJETER"].includes(action)) {
      return NextResponse.json({ error: "Action invalide. Valeurs : APPROUVER, REJETER" }, { status: 400 });
    }

    const anomalie = await prisma.anomalieStock.findUnique({
      where: { id: anomalieId },
      include: {
        produit:      { select: { nom: true, prixAchat: true, prixUnitaire: true } },
        pointDeVente: { select: { nom: true } },
        magasinier:   { select: { id: true, nom: true, prenom: true } },
      },
    });
    if (!anomalie) return NextResponse.json({ error: "Anomalie introuvable" }, { status: 404 });

    if (anomalie.statut !== "TRANSMISE") {
      return NextResponse.json(
        { error: `Impossible de traiter : statut actuel "${anomalie.statut}" (attendu : TRANSMISE)` },
        { status: 400 }
      );
    }

    if (!anomalie.pointDeVenteId) {
      return NextResponse.json({ error: "Aucun point de vente associé à cette anomalie" }, { status: 400 });
    }

    const typeLabel: Record<string, string> = {
      MANQUANT: "Manquant", SURPLUS: "Surplus", DEFECTUEUX: "Défectueux",
      PERTE: "Perte", CASSE: "Casse", VOL: "Vol",
    };
    const adminNom = `${session.user.prenom} ${session.user.nom}`;

    const updated = await prisma.$transaction(async (tx) => {
      const adminId = parseInt(session.user.id);

      if (action === "APPROUVER") {
        // Vérifier le stock disponible
        const stockSite = await tx.stockSite.findUnique({
          where: {
            produitId_pointDeVenteId: {
              produitId: anomalie.produitId,
              pointDeVenteId: anomalie.pointDeVenteId!,
            },
          },
        });

        const dispo = (stockSite?.quantite ?? 0) - (stockSite?.quantiteReservee ?? 0);
        if (dispo < anomalie.quantite) {
          throw new Error(
            `Stock disponible insuffisant pour la déclaration (disponible : ${dispo < 0 ? 0 : dispo}, déclaré : ${anomalie.quantite})`
          );
        }

        // Déterminer le typeSortie selon le type d'anomalie
        type TSortie = "PERTE" | "CASSE" | "VOL" | "AJUSTEMENT_NEGATIF";
        const typeSortieMap: Record<string, TSortie> = {
          PERTE:     "PERTE",
          CASSE:     "CASSE",
          VOL:       "VOL",
          DEFECTUEUX:"CASSE",
          MANQUANT:  "AJUSTEMENT_NEGATIF",
          SURPLUS:   "AJUSTEMENT_NEGATIF",
        };
        const typeSortie = typeSortieMap[anomalie.type] ?? "AJUSTEMENT_NEGATIF";
        const isCasse    = anomalie.type === "CASSE" || anomalie.type === "DEFECTUEUX";

        // Décrémenter le stock disponible
        await tx.stockSite.update({
          where: {
            produitId_pointDeVenteId: {
              produitId: anomalie.produitId,
              pointDeVenteId: anomalie.pointDeVenteId!,
            },
          },
          data: {
            quantite: { decrement: anomalie.quantite },
            // Pour la casse : aussi incrémenter quantiteEndommagee
            ...(isCasse && { quantiteEndommagee: { increment: anomalie.quantite } }),
          },
        });

        // Créer le mouvement de sortie
        const prixUnit = Number(anomalie.produit.prixAchat ?? anomalie.produit.prixUnitaire);
        const valeurPerte = prixUnit * anomalie.quantite;

        await tx.mouvementStock.create({
          data: {
            produitId:      anomalie.produitId,
            pointDeVenteId: anomalie.pointDeVenteId!,
            type:           "SORTIE",
            typeSortie:     typeSortie as never,
            quantite:       anomalie.quantite,
            motif:          `${typeLabel[anomalie.type]} — ${anomalie.description} (ref: ${anomalie.reference}, approuvé par ${adminNom})`,
            reference:      `${anomalie.reference}-SORTIE-${randomUUID().slice(0, 4).toUpperCase()}`,
            operateurId:    adminId,
          },
        });

        const a = await tx.anomalieStock.update({
          where: { id: anomalieId },
          data: {
            statut:      "TRAITEE",
            traitePar:   adminId,
            commentaire: motif
              ? `Approuvé par ${adminNom} : ${motif}`
              : `Approuvé par ${adminNom}. Impact financier : ${valeurPerte.toLocaleString("fr-FR")} FCFA`,
          },
        });

        await auditLog(tx, adminId, "ANOMALIE_APPROUVEE_ADMIN", "AnomalieStock", anomalieId);

        // Notifier magasinier + logistique + RPV
        await notifyRoles(
          tx,
          ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "RESPONSABLE_POINT_DE_VENTE"],
          {
            titre:    `${typeLabel[anomalie.type]} approuvée — ${anomalie.produit.nom}`,
            message:  `L'administrateur ${adminNom} a approuvé la déclaration de ${typeLabel[anomalie.type].toLowerCase()} (${anomalie.quantite} unité(s) de "${anomalie.produit.nom}"). Impact financier : ${valeurPerte.toLocaleString("fr-FR")} FCFA. Stock mis à jour.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl:`/dashboard/user/logistiquesApprovisionnements`,
          }
        );

        await tx.notification.create({
          data: {
            userId:    anomalie.magasinier.id,
            titre:     `Déclaration approuvée — ${anomalie.produit.nom}`,
            message:   `Votre déclaration de ${typeLabel[anomalie.type].toLowerCase()} (${anomalie.quantite} unité(s)) a été approuvée par ${adminNom}. Stock décrémenté.`,
            priorite:  PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/user/magasiniers`,
          },
        });

        return a;
      } else {
        // REJETER → renvoyer en EN_ATTENTE pour re-examen par Resp Appro
        const a = await tx.anomalieStock.update({
          where: { id: anomalieId },
          data: {
            statut:      "EN_ATTENTE",
            traitePar:   adminId,
            commentaire: motif ? `Rejeté par ${adminNom} : ${motif}` : `Rejeté par ${adminNom}`,
          },
        });

        await auditLog(tx, adminId, "ANOMALIE_REJETEE_ADMIN", "AnomalieStock", anomalieId);

        await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {
          titre:    `Déclaration rejetée par l'admin — ${anomalie.produit.nom}`,
          message:  `L'administrateur ${adminNom} a rejeté la déclaration de ${typeLabel[anomalie.type].toLowerCase()} sur "${anomalie.produit.nom}".${motif ? ` Motif : ${motif}` : ""}`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl:`/dashboard/user/logistiquesApprovisionnements`,
        });

        return a;
      }
    });

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    console.error("PATCH /admin/anomalies/[id]:", error);
    const isStockError = msg.includes("Stock disponible insuffisant");
    return NextResponse.json({ error: msg }, { status: isStockError ? 400 : 500 });
  }
}
