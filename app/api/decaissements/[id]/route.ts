import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getComptableSession } from "@/lib/authComptable";
import { getCaissierSession } from "@/lib/authCaissier";
import { auditLog, notify, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { getSeuilApprobationN2Decaissement } from "@/lib/parametresDocuments";
import { ecritureDecaissement, ecripturePaiementFournisseur } from "@/lib/comptabilite/moteur";
import { INCLUDE } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const fiche = await prisma.ficheDecaissement.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!fiche) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });

    const isComptableOuAdmin = !!(await getComptableSession());
    if (!isComptableOuAdmin && fiche.demandeurId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const seuilN2 = await getSeuilApprobationN2Decaissement();
    return NextResponse.json({ data: fiche, seuilN2 });
  } catch (error) {
    console.error("GET /decaissements/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/decaissements/[id]
 * Actions : { action: "APPROUVER_N1" | "APPROUVER_N2" | "REJETER" | "EXECUTER" }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const ficheId = Number(id);
    const fiche = await prisma.ficheDecaissement.findUnique({
      where: { id: ficheId },
      include: { fournisseur: { select: { nom: true } }, demandeur: { select: { id: true, nom: true, prenom: true } } },
    });
    if (!fiche) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });

    const body = await req.json();
    const seuilN2 = await getSeuilApprobationN2Decaissement();

    if (body.action === "APPROUVER_N1") {
      const session = await getComptableSession();
      if (!session) return NextResponse.json({ error: "Réservé au Comptable/Chef Comptable" }, { status: 403 });
      if (fiche.statut !== "SOUMISE" || fiche.approbateurN1Id != null) {
        return NextResponse.json({ error: "Cette fiche n'est plus en attente d'approbation N1" }, { status: 422 });
      }
      const montantApprouve = body.montantApprouve != null ? Number(body.montantApprouve) : Number(fiche.montantDemande);
      const motifEcartMontant = String(body.motifEcartMontant || "").trim() || null;
      if (Math.abs(montantApprouve - Number(fiche.montantDemande)) > 0.01 && !motifEcartMontant) {
        return NextResponse.json({ error: "Montant approuvé différent du montant demandé : motif obligatoire" }, { status: 400 });
      }
      const besoinN2 = montantApprouve > seuilN2;
      const userId = parseInt(session.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        const f = await tx.ficheDecaissement.update({
          where: { id: ficheId },
          data: {
            approbateurN1Id: userId, dateApprobationN1: new Date(),
            montantApprouve, motifEcartMontant,
            statut: besoinN2 ? "SOUMISE" : "APPROUVEE",
          },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "FD_APPROUVEE_N1", "FicheDecaissement", ficheId, { besoinN2 }, getRequestMeta(req));
        if (besoinN2) {
          // Notifie la Direction (ADMIN/SUPER_ADMIN) — notifyRoles([]) = admins uniquement.
          await notifyRoles(tx, [], {
            titre: `Décaissement en attente d'approbation N2 (${fiche.reference})`,
            message: `${montantApprouve.toLocaleString("fr-FR")} FCFA pour "${fiche.beneficiaireNom}" dépasse le seuil de ${seuilN2.toLocaleString("fr-FR")} FCFA — approbation Direction requise.`,
            priorite: PrioriteNotification.HAUTE,
            actionUrl: `/dashboard/user/decaissements?detail=${ficheId}`,
          });
        } else {
          await notify(tx, [fiche.demandeurId], {
            titre: `Fiche ${fiche.reference} approuvée`,
            message: `Approuvée pour ${montantApprouve.toLocaleString("fr-FR")} FCFA — en attente de paiement.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/user/decaissements?detail=${ficheId}`,
          });
          await notifyRoles(tx, ["CAISSIER", "COMPTABLE"], {
            titre: `Décaissement approuvé à exécuter (${fiche.reference})`,
            message: `${montantApprouve.toLocaleString("fr-FR")} FCFA pour "${fiche.beneficiaireNom}".`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/user/decaissements?detail=${ficheId}`,
          });
        }
        return f;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "APPROUVER_N2") {
      const session = await getAuthSession();
      if (!session || (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")) {
        return NextResponse.json({ error: "Réservé à la Direction Générale" }, { status: 403 });
      }
      if (fiche.statut !== "SOUMISE" || fiche.approbateurN1Id == null || fiche.approbateurN2Id != null) {
        return NextResponse.json({ error: "Cette fiche n'est pas en attente d'approbation N2" }, { status: 422 });
      }
      const montantBase = fiche.montantApprouve != null ? Number(fiche.montantApprouve) : Number(fiche.montantDemande);
      if (montantBase <= seuilN2) {
        return NextResponse.json({ error: "Cette fiche ne dépasse pas le seuil d'approbation N2" }, { status: 422 });
      }
      const montantApprouve = body.montantApprouve != null ? Number(body.montantApprouve) : montantBase;
      const motifEcartMontant = String(body.motifEcartMontant || "").trim() || fiche.motifEcartMontant;
      if (Math.abs(montantApprouve - Number(fiche.montantDemande)) > 0.01 && !motifEcartMontant) {
        return NextResponse.json({ error: "Montant approuvé différent du montant demandé : motif obligatoire" }, { status: 400 });
      }
      const userId = parseInt(session.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        const f = await tx.ficheDecaissement.update({
          where: { id: ficheId },
          data: { approbateurN2Id: userId, dateApprobationN2: new Date(), montantApprouve, motifEcartMontant, statut: "APPROUVEE" },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "FD_APPROUVEE_N2", "FicheDecaissement", ficheId, undefined, getRequestMeta(req));
        await notify(tx, [fiche.demandeurId], {
          titre: `Fiche ${fiche.reference} approuvée`,
          message: `Approuvée par la Direction pour ${montantApprouve.toLocaleString("fr-FR")} FCFA — en attente de paiement.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/decaissements?detail=${ficheId}`,
        });
        await notifyRoles(tx, ["CAISSIER", "COMPTABLE"], {
          titre: `Décaissement approuvé à exécuter (${fiche.reference})`,
          message: `${montantApprouve.toLocaleString("fr-FR")} FCFA pour "${fiche.beneficiaireNom}".`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/decaissements?detail=${ficheId}`,
        });
        return f;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "REJETER") {
      const comptable = await getComptableSession();
      const admin = await getAuthSession();
      const isAdmin = !!admin && (admin.user.role === "ADMIN" || admin.user.role === "SUPER_ADMIN");
      const session = comptable ?? (isAdmin ? admin : null);
      if (!session) return NextResponse.json({ error: "Réservé au Comptable/Chef Comptable/Direction" }, { status: 403 });
      if (fiche.statut !== "SOUMISE") return NextResponse.json({ error: "Impossible depuis ce statut" }, { status: 422 });
      const motifRejet = String(body.motifRejet || "").trim();
      if (!motifRejet) return NextResponse.json({ error: "Motif de rejet obligatoire" }, { status: 400 });
      const userId = parseInt(session.user.id);
      const updated = await prisma.$transaction(async (tx) => {
        const f = await tx.ficheDecaissement.update({ where: { id: ficheId }, data: { statut: "REJETEE", motifRejet }, include: INCLUDE });
        await auditLog(tx, userId, "FD_REJETEE", "FicheDecaissement", ficheId, { motifRejet }, getRequestMeta(req));
        await notify(tx, [fiche.demandeurId], {
          titre: `Fiche ${fiche.reference} rejetée`,
          message: `Motif : ${motifRejet}`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/user/decaissements?detail=${ficheId}`,
        });
        return f;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "EXECUTER") {
      const session = (await getCaissierSession()) ?? (await getComptableSession());
      if (!session) return NextResponse.json({ error: "Réservé au Caissier/Comptable" }, { status: 403 });
      if (fiche.statut !== "APPROUVEE") return NextResponse.json({ error: "La fiche doit être approuvée avant exécution" }, { status: 422 });
      const modePaiement = body.modePaiement;
      if (!["ESPECES", "MOBILE_MONEY", "CHEQUE", "VIREMENT"].includes(modePaiement)) {
        return NextResponse.json({ error: "Mode de paiement invalide" }, { status: 400 });
      }
      const referencePaiement = String(body.referencePaiement || "").trim();
      if (!referencePaiement) return NextResponse.json({ error: "Référence de paiement obligatoire" }, { status: 400 });
      const beneficiaireConfirmationNom = String(body.beneficiaireConfirmationNom || "").trim();
      if (!beneficiaireConfirmationNom) return NextResponse.json({ error: "Confirmation de réception du bénéficiaire obligatoire" }, { status: 400 });

      const userId = parseInt(session.user.id);
      const montant = fiche.montantApprouve != null ? Number(fiche.montantApprouve) : Number(fiche.montantDemande);

      const updated = await prisma.$transaction(async (tx) => {
        let ecritureId: number | null = null;
        if (fiche.typeDepense === "PAIEMENT_FOURNISSEUR" && fiche.fournisseurId) {
          ecritureId = await ecripturePaiementFournisseur(tx, {
            montant, reference: fiche.reference, fournisseurNom: fiche.fournisseur?.nom ?? fiche.beneficiaireNom,
            fournisseurId: fiche.fournisseurId, modePaiement, userId, pointDeVenteId: fiche.pointDeVenteId,
          });
        } else {
          const typeAccepte = ["ACHAT_MARCHANDISES", "FOURNITURES", "AVANCE_CAISSE", "FRAIS_FONCTIONNEMENT", "TRANSPORT", "AUTRES"].includes(fiche.typeDepense)
            ? (fiche.typeDepense as "ACHAT_MARCHANDISES" | "FOURNITURES" | "AVANCE_CAISSE" | "FRAIS_FONCTIONNEMENT" | "TRANSPORT" | "AUTRES")
            : "AUTRES";
          ecritureId = await ecritureDecaissement(tx, {
            montant, reference: fiche.reference, typeDepense: typeAccepte, beneficiaireNom: fiche.beneficiaireNom,
            modePaiement, userId, pointDeVenteId: fiche.pointDeVenteId,
          });
        }

        const f = await tx.ficheDecaissement.update({
          where: { id: ficheId },
          data: {
            statut: "PAYEE", executeParId: userId, dateExecution: new Date(),
            modePaiement, referencePaiement,
            beneficiaireConfirmationNom, beneficiaireConfirmationPiece: body.beneficiaireConfirmationPiece || null,
            dateConfirmationBeneficiaire: new Date(),
            ecritureId,
          },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "FD_PAYEE", "FicheDecaissement", ficheId, { montant, ecritureId }, getRequestMeta(req));
        await notify(tx, [fiche.demandeurId], {
          titre: `Fiche ${fiche.reference} payée`,
          message: `${montant.toLocaleString("fr-FR")} FCFA versés à "${fiche.beneficiaireNom}".`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/decaissements?detail=${ficheId}`,
        });
        if (fiche.typeDepense === "ACHAT_MARCHANDISES") {
          await notifyRoles(tx, ["MAGAZINIER"], {
            titre: `Paiement effectué — réception à anticiper (${fiche.reference})`,
            message: `Le décaissement pour "${fiche.beneficiaireNom}" a été payé — anticiper la réception en stock.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/user/decaissements?detail=${ficheId}`,
          });
        }
        return f;
      });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /decaissements/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
