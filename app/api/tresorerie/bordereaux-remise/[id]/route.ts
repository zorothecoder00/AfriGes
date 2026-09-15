import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog, notify, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { getSeuilVisaCGTBordereauRemise } from "@/lib/parametresDocuments";
import { getSession, INCLUDE } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const bordereau = await prisma.bordereauRemiseFonds.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!bordereau) return NextResponse.json({ error: "Bordereau introuvable" }, { status: 404 });

    const isTresorierOuAdmin = !!(await getComptableSession());
    if (!isTresorierOuAdmin && bordereau.collecteurId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const seuilVisaCGT = await getSeuilVisaCGTBordereauRemise();
    return NextResponse.json({ data: bordereau, seuilVisaCGT });
  } catch (error) {
    console.error("GET /tresorerie/bordereaux-remise/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/tresorerie/bordereaux-remise/[id]
 * Actions : { action: "TRAITER" | "VISER_CGT" | "CLOTURER" }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const bordereauId = Number(id);
    const bordereau = await prisma.bordereauRemiseFonds.findUnique({ where: { id: bordereauId }, include: { pointDeVente: { select: { nom: true } }, collecteur: { select: { nom: true, prenom: true } } } });
    if (!bordereau) return NextResponse.json({ error: "Bordereau introuvable" }, { status: 404 });

    const body = await req.json();

    if (body.action === "TRAITER") {
      const session = await getComptableSession();
      if (!session) return NextResponse.json({ error: "Réservé au trésorier (Comptable/Chef Comptable)" }, { status: 403 });
      if (!["SOUMIS", "ECART_SIGNALE"].includes(bordereau.statut)) {
        return NextResponse.json({ error: `Impossible depuis le statut ${bordereau.statut}` }, { status: 422 });
      }
      const montantConfirmeTresorier = Number(body.montantConfirmeTresorier);
      if (!Number.isFinite(montantConfirmeTresorier) || montantConfirmeTresorier < 0) {
        return NextResponse.json({ error: "Montant confirmé invalide" }, { status: 400 });
      }
      const ecartTresorier = montantConfirmeTresorier - Number(bordereau.totalBilletageCalcule);
      const motifEcartTresorier = String(body.motifEcartTresorier || "").trim() || null;
      const aEcart = Math.abs(ecartTresorier) > 0.01;
      if (aEcart && !motifEcartTresorier) {
        return NextResponse.json({ error: "Écart constaté par le trésorier : motif obligatoire" }, { status: 400 });
      }
      const userId = parseInt(session.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        const b = await tx.bordereauRemiseFonds.update({
          where: { id: bordereauId },
          data: {
            tresorierId: userId,
            montantConfirmeTresorier,
            dateTraitementTresorier: new Date(),
            ecartTresorier,
            motifEcartTresorier,
            statut: aEcart ? "ECART_SIGNALE" : "VALIDE",
          },
          include: INCLUDE,
        });
        await auditLog(tx, userId, aEcart ? "BRF_ECART_SIGNALE" : "BRF_VALIDE", "BordereauRemiseFonds", bordereauId, { ecartTresorier }, getRequestMeta(req));
        if (aEcart) {
          await notifyRoles(tx, ["AUDITEUR_INTERNE"], {
            titre: `Écart signalé sur bordereau ${bordereau.reference}`,
            message: `Le trésorier a constaté un écart de ${ecartTresorier.toLocaleString("fr-FR")} FCFA sur le bordereau de ${b.collecteur.prenom} ${b.collecteur.nom} ("${bordereau.pointDeVente.nom}"). Motif : ${motifEcartTresorier}.`,
            priorite: PrioriteNotification.HAUTE,
            actionUrl: `/dashboard/user/comptables/tresorerie/bordereaux-remise?detail=${bordereauId}`,
          });
        } else {
          await notify(tx, [bordereau.collecteurId], {
            titre: `Bordereau ${bordereau.reference} confirmé`,
            message: `Le trésorier a confirmé la réception de ${montantConfirmeTresorier.toLocaleString("fr-FR")} FCFA sans écart.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/user/agentsTerrain/bordereaux-remise?detail=${bordereauId}`,
          });
        }
        return b;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "VISER_CGT") {
      const session = await getComptableSession();
      if (!session || (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")) {
        return NextResponse.json({ error: "Seule la Direction peut apposer ce visa" }, { status: 403 });
      }
      if (bordereau.statut !== "VALIDE") {
        return NextResponse.json({ error: "Le bordereau doit être validé par le trésorier avant le visa CGT" }, { status: 422 });
      }
      const userId = parseInt(session.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        const b = await tx.bordereauRemiseFonds.update({
          where: { id: bordereauId },
          data: { visaCGTParId: userId, dateVisaCGT: new Date() },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "BRF_VISA_CGT", "BordereauRemiseFonds", bordereauId, undefined, getRequestMeta(req));
        return b;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "CLOTURER") {
      const session = await getComptableSession();
      if (!session) return NextResponse.json({ error: "Réservé au trésorier (Comptable/Chef Comptable)" }, { status: 403 });
      if (bordereau.statut !== "VALIDE") {
        return NextResponse.json({ error: "Le bordereau doit être validé avant clôture" }, { status: 422 });
      }
      const montantTotal = Number(bordereau.totalBilletageCalcule) + Number(bordereau.cotisationsMobileMoney) + Number(bordereau.montantVirement);
      const seuil = await getSeuilVisaCGTBordereauRemise();
      if (montantTotal > seuil && !bordereau.visaCGTParId) {
        return NextResponse.json({ error: `Visa Président CGT requis avant clôture (montant > ${seuil.toLocaleString("fr-FR")} FCFA)` }, { status: 422 });
      }
      const depotBancaireReference = String(body.depotBancaireReference || "").trim();
      if (!depotBancaireReference) {
        return NextResponse.json({ error: "Référence de dépôt bancaire obligatoire pour la clôture" }, { status: 400 });
      }
      const userId = parseInt(session.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        const b = await tx.bordereauRemiseFonds.update({
          where: { id: bordereauId },
          data: {
            statut: "CLOTURE",
            depotBancaireReference,
            dateDepotBancaire: body.dateDepotBancaire ? new Date(body.dateDepotBancaire) : new Date(),
            clotureParId: userId,
            dateCloture: new Date(),
          },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "BRF_CLOTURE", "BordereauRemiseFonds", bordereauId, undefined, getRequestMeta(req));
        return b;
      });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /tresorerie/bordereaux-remise/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
