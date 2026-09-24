import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog, notify, notifyRoles, notifyAdmins, ROLES_COMPTABLES } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { getSeuilVisaCGTBordereauRemise } from "@/lib/parametresDocuments";
import { ecritureBordereauRemiseFonds } from "@/lib/comptabilite/moteur";
import { getRPVSession } from "@/lib/authRPV";
import { signatureTracee } from "@/lib/signature";
import { getSession, INCLUDE, estRpvDuPdv } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const bordereau = await prisma.bordereauRemiseFonds.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!bordereau) return NextResponse.json({ error: "Bordereau introuvable" }, { status: 404 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const isComptable = !!(await getComptableSession());
    let isCaissierDuPdv = false;
    if (!isAdmin && !isComptable) {
      const caissier = await getCaissierSession();
      if (caissier) {
        const pdvId = await getCaissierPdvId(parseInt(session.user.id));
        isCaissierDuPdv = pdvId === bordereau.pointDeVenteId;
      }
    }
    const isRpvDuPdv = !isAdmin && !isComptable && !isCaissierDuPdv
      && session.user.gestionnaireRole === "RESPONSABLE_POINT_DE_VENTE"
      && await estRpvDuPdv(parseInt(session.user.id), bordereau.pointDeVenteId);
    if (!isAdmin && !isComptable && !isCaissierDuPdv && !isRpvDuPdv && bordereau.collecteurId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const seuilVisaCGT = await getSeuilVisaCGTBordereauRemise();
    const pieces = await prisma.pieceJustificative.findMany({
      where: { sourceType: "BORDEREAU_REMISE", sourceId: bordereau.id },
      select: { id: true, nom: true, url: true, nature: true, type: true, taille: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ data: { ...bordereau, pieces }, seuilVisaCGT });
  } catch (error) {
    console.error("GET /tresorerie/bordereaux-remise/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * Génère l'écriture de clôture (Dr Banque / Cr Caisse) et fait passer le
 * bordereau en CLOTURE — appelé automatiquement dès que le circuit est
 * intégralement validé (billetage confirmé par le caissier, sans écart, et
 * visa CGT obtenu si le montant dépasse le seuil) : le comptable reçoit
 * l'écriture sans étape manuelle supplémentaire.
 */
async function cloturerAutomatiquement(
  tx: Parameters<typeof ecritureBordereauRemiseFonds>[0],
  bordereau: { id: number; reference: string; pointDeVenteId: number; totalBilletageCalcule: unknown; cotisationsMobileMoney: unknown; montantVirement: unknown; collecteur: { nom: string; prenom: string } },
  userId: number,
) {
  const montantTotal = Number(bordereau.totalBilletageCalcule) + Number(bordereau.cotisationsMobileMoney) + Number(bordereau.montantVirement);
  const ecritureId = await ecritureBordereauRemiseFonds(tx, {
    montant: montantTotal,
    reference: bordereau.reference,
    collecteurNom: `${bordereau.collecteur.prenom} ${bordereau.collecteur.nom}`,
    userId,
    pointDeVenteId: bordereau.pointDeVenteId,
  });
  await tx.bordereauRemiseFonds.update({
    where: { id: bordereau.id },
    data: { statut: "CLOTURE", clotureParId: userId, dateCloture: new Date(), ecritureId },
  });
  return { montantTotal, ecritureId };
}

/**
 * PATCH /api/tresorerie/bordereaux-remise/[id]
 * Actions : { action: "TRAITER" | "VISER_CGT" | "ENREGISTRER_DEPOT" }
 *
 * Circuit (CDC digitalisation §3.1) :
 *   1. Agent : SOUMIS (déjà géré par POST ../route.ts)
 *   2. Caissier (de l'agence de dépôt) : TRAITER — comptage contradictoire du
 *      billetage. Sans écart : VALIDE puis, si le montant ne dépasse pas le
 *      seuil de visa CGT, CLOTURE immédiatement (écriture comptable générée
 *      automatiquement). Avec écart : ECART_SIGNALE (contrôle manuel).
 *   3. Président — Direction (admin) ou RPV de l'agence : VISER_CGT — uniquement
 *      si le montant dépasse le seuil ; dès le visa accordé, CLOTURE immédiatement
 *      (même écriture automatique).
 *   TRAITER et VISER_CGT acceptent un tracé de signature facultatif
 *   (signatureTresorier / signatureVisaCGT) imprimé sur le bordereau ; la
 *   validation horodatée vaut signature électronique.
 *   4. Comptable : ENREGISTRER_DEPOT — rattache après coup la référence du
 *      dépôt bancaire réel, purement informatif (n'a plus d'effet sur
 *      l'écriture, déjà générée à l'étape 2 ou 3).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const bordereauId = Number(id);
    const bordereau = await prisma.bordereauRemiseFonds.findUnique({
      where: { id: bordereauId },
      include: { pointDeVente: { select: { nom: true } }, collecteur: { select: { nom: true, prenom: true } } },
    });
    if (!bordereau) return NextResponse.json({ error: "Bordereau introuvable" }, { status: 404 });

    const body = await req.json();

    if (body.action === "TRAITER") {
      const session = await getCaissierSession();
      if (!session) return NextResponse.json({ error: "Réservé au caissier (ou admin)" }, { status: 403 });
      const userId = parseInt(session.user.id);
      const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
      if (!isAdmin) {
        const pdvId = await getCaissierPdvId(userId);
        if (pdvId !== bordereau.pointDeVenteId) {
          return NextResponse.json({ error: "Ce bordereau n'a pas été déposé dans votre point de vente" }, { status: 403 });
        }
      }
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
        return NextResponse.json({ error: "Écart constaté par le caissier : motif obligatoire" }, { status: 400 });
      }

      const seuil = await getSeuilVisaCGTBordereauRemise();
      const montantTotalPrevu = Number(bordereau.totalBilletageCalcule) + Number(bordereau.cotisationsMobileMoney) + Number(bordereau.montantVirement);
      const visaRequis = !aEcart && montantTotalPrevu > seuil;
      const caissierNom = `${session.user.prenom} ${session.user.nom}`;

      const updated = await prisma.$transaction(async (tx) => {
        await tx.bordereauRemiseFonds.update({
          where: { id: bordereauId },
          data: {
            tresorierId: userId,
            montantConfirmeTresorier,
            dateTraitementTresorier: new Date(),
            ecartTresorier,
            motifEcartTresorier,
            signatureTresorier: signatureTracee(body.signatureTresorier),
            statut: aEcart ? "ECART_SIGNALE" : "VALIDE",
          },
        });

        let clotureInfo: { montantTotal: number; ecritureId: number | null } | null = null;
        if (!aEcart && !visaRequis) {
          clotureInfo = await cloturerAutomatiquement(tx, bordereau, userId);
        }

        const b = await tx.bordereauRemiseFonds.findUniqueOrThrow({ where: { id: bordereauId }, include: INCLUDE });

        await auditLog(
          tx, userId,
          aEcart ? "BRF_ECART_SIGNALE" : clotureInfo ? "BRF_VALIDE_ET_CLOTURE_AUTO" : "BRF_VALIDE",
          "BordereauRemiseFonds", bordereauId, { ecartTresorier, ecritureId: clotureInfo?.ecritureId ?? null }, getRequestMeta(req),
        );

        if (aEcart) {
          await notifyRoles(tx, ["AUDITEUR_INTERNE"], {
            titre: `Écart signalé sur bordereau ${bordereau.reference}`,
            message: `Le caissier ${caissierNom} a constaté un écart de ${ecartTresorier.toLocaleString("fr-FR")} FCFA sur le bordereau de ${b.collecteur.prenom} ${b.collecteur.nom} ("${bordereau.pointDeVente.nom}"). Motif : ${motifEcartTresorier}.`,
            priorite: PrioriteNotification.HAUTE,
            actionUrl: `/dashboard/user/comptables/tresorerie/bordereaux-remise?detail=${bordereauId}`,
          });
          await notifyRoles(tx, ROLES_COMPTABLES, {
            titre: `Écart bordereau ${bordereau.reference}`,
            message: `Écart de ${ecartTresorier.toLocaleString("fr-FR")} FCFA à examiner (bordereau de ${b.collecteur.prenom} ${b.collecteur.nom}).`,
            priorite: PrioriteNotification.HAUTE,
            actionUrl: `/dashboard/user/comptables/tresorerie/bordereaux-remise?detail=${bordereauId}`,
          });
        } else {
          await notify(tx, [bordereau.collecteurId], {
            titre: `Bordereau ${bordereau.reference} confirmé`,
            message: `Le caissier a confirmé la réception de ${montantConfirmeTresorier.toLocaleString("fr-FR")} FCFA sans écart.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/user/agentsTerrain/bordereaux-remise?detail=${bordereauId}`,
          });
          if (clotureInfo) {
            await notifyRoles(tx, ROLES_COMPTABLES, {
              titre: `Écriture générée — ${bordereau.reference}`,
              message: `Circuit validé par ${caissierNom} : écriture comptable de ${clotureInfo.montantTotal.toLocaleString("fr-FR")} FCFA générée automatiquement pour "${bordereau.pointDeVente.nom}".`,
              priorite: PrioriteNotification.NORMAL,
              actionUrl: `/dashboard/user/comptables/tresorerie/bordereaux-remise?detail=${bordereauId}`,
            });
          } else if (visaRequis) {
            const message = `Billetage confirmé par ${caissierNom} (${montantTotalPrevu.toLocaleString("fr-FR")} FCFA > seuil de ${seuil.toLocaleString("fr-FR")} FCFA) : visa Président CGT requis avant clôture.`;
            await notifyAdmins(tx, {
              titre: `Visa Direction requis — ${bordereau.reference}`,
              message,
              priorite: PrioriteNotification.HAUTE,
              actionUrl: `/dashboard/admin/bordereaux-remise?detail=${bordereauId}`,
            });
            // Le RPV de l'agence peut aussi apposer le visa.
            const pdv = await tx.pointDeVente.findUnique({ where: { id: bordereau.pointDeVenteId }, select: { rpvId: true } });
            if (pdv?.rpvId) {
              await notify(tx, [pdv.rpvId], {
                titre: `Visa requis — ${bordereau.reference}`,
                message,
                priorite: PrioriteNotification.HAUTE,
                actionUrl: `/dashboard/user/responsablesPointDeVente/bordereaux-remise?detail=${bordereauId}`,
              });
            }
          }
        }
        return b;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "VISER_CGT") {
      // Président : Direction (admin) ou RPV de l'agence de dépôt.
      const session = await getRPVSession();
      const estDirection = session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
      if (!session || (!estDirection && !(await estRpvDuPdv(parseInt(session.user.id), bordereau.pointDeVenteId)))) {
        return NextResponse.json({ error: "Seuls la Direction ou le RPV de l'agence peuvent apposer ce visa" }, { status: 403 });
      }
      if (bordereau.statut !== "VALIDE") {
        return NextResponse.json({ error: "Le bordereau doit être validé (billetage confirmé par le caissier) avant le visa CGT" }, { status: 422 });
      }
      const userId = parseInt(session.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        await tx.bordereauRemiseFonds.update({
          where: { id: bordereauId },
          data: { visaCGTParId: userId, dateVisaCGT: new Date(), signatureVisaCGT: signatureTracee(body.signatureVisaCGT) },
        });
        const clotureInfo = await cloturerAutomatiquement(tx, bordereau, userId);
        const b = await tx.bordereauRemiseFonds.findUniqueOrThrow({ where: { id: bordereauId }, include: INCLUDE });
        await auditLog(tx, userId, "BRF_VISA_CGT_ET_CLOTURE_AUTO", "BordereauRemiseFonds", bordereauId, { ecritureId: clotureInfo.ecritureId }, getRequestMeta(req));
        await notifyRoles(tx, ROLES_COMPTABLES, {
          titre: `Écriture générée — ${bordereau.reference}`,
          message: `Visa Président CGT accordé : écriture comptable de ${clotureInfo.montantTotal.toLocaleString("fr-FR")} FCFA générée automatiquement pour "${bordereau.pointDeVente.nom}".`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/comptables/tresorerie/bordereaux-remise?detail=${bordereauId}`,
        });
        return b;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "ENREGISTRER_DEPOT") {
      // Informatif uniquement — l'écriture comptable existe déjà (générée
      // automatiquement à la validation) ; ceci ne fait que tracer la
      // référence du dépôt bancaire réel une fois effectué.
      const session = await getComptableSession();
      if (!session) return NextResponse.json({ error: "Réservé au comptable" }, { status: 403 });
      if (bordereau.statut !== "CLOTURE") {
        return NextResponse.json({ error: "Le bordereau doit être clôturé (circuit validé) avant d'y rattacher un dépôt bancaire" }, { status: 422 });
      }
      const depotBancaireReference = String(body.depotBancaireReference || "").trim();
      if (!depotBancaireReference) {
        return NextResponse.json({ error: "Référence de dépôt bancaire obligatoire" }, { status: 400 });
      }
      const userId = parseInt(session.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        const b = await tx.bordereauRemiseFonds.update({
          where: { id: bordereauId },
          data: { depotBancaireReference, dateDepotBancaire: body.dateDepotBancaire ? new Date(body.dateDepotBancaire) : new Date() },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "BRF_DEPOT_ENREGISTRE", "BordereauRemiseFonds", bordereauId, undefined, getRequestMeta(req));
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
