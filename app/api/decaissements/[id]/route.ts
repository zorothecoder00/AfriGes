import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getComptableSession } from "@/lib/authComptable";
import { getCaissierSession } from "@/lib/authCaissier";
import { auditLog, notify, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { getSeuilApprobationN2Decaissement } from "@/lib/parametresDocuments";
import { ecritureDecaissement, ecripturePaiementFournisseur, assurerEcritureOperationCaisse } from "@/lib/comptabilite/moteur";
import { INCLUDE } from "../route";
import { signatureTracee } from "@/lib/signature";

/** Catégorie de sortie de caisse correspondant au type de dépense de la fiche. */
const CATEGORIE_CAISSE: Record<string, "SALAIRE" | "AVANCE" | "FOURNISSEUR" | "CARBURANT" | "AUTRE"> = {
  SALAIRE: "SALAIRE", CARBURANT: "CARBURANT", AVANCE_CAISSE: "AVANCE", PAIEMENT_FOURNISSEUR: "FOURNISSEUR", ACHAT_MARCHANDISES: "FOURNISSEUR",
};

type Ctx = { params: Promise<{ id: string }> };

type FicheEffets = {
  id: number; reference: string; typeDepense: string; beneficiaireNom: string; pointDeVenteId: number | null;
  fournisseurId: number | null; fournisseur: { nom: string } | null;
  bonCommandeFournisseurId: number | null; reglementDepotVenteId: number | null;
  operationCaisseId: number | null; operationCaissePDVId: number | null;
};

/**
 * Effets comptables/métier d'un décaissement effectif : écriture comptable, montant payé du
 * Bon de Commande fournisseur, règlement dépôt-vente. Appelé à l'exécution (anciennes fiches)
 * ou à l'approbation finale (fiches rattachées à une sortie de caisse : l'argent est déjà sorti).
 * Fiche liée à une sortie de caisse : l'écriture de trésorerie est celle de la sortie elle-même
 * (créée avec elle) — on la retrouve/complète sans en créer une seconde (pas de double comptage).
 */
async function appliquerEffetsPaiement(
  tx: Prisma.TransactionClient, fiche: FicheEffets, montant: number,
  modePaiement: "ESPECES" | "MOBILE_MONEY" | "CHEQUE" | "VIREMENT", userId: number,
): Promise<number | null> {
  let ecritureId: number | null = null;
  if (fiche.operationCaisseId != null || fiche.operationCaissePDVId != null) {
    ecritureId = await assurerEcritureOperationCaisse(
      tx, { operationCaisseId: fiche.operationCaisseId, operationCaissePDVId: fiche.operationCaissePDVId }, userId,
    );
  } else if (fiche.typeDepense === "PAIEMENT_FOURNISSEUR" && fiche.fournisseurId) {
    ecritureId = await ecripturePaiementFournisseur(tx, {
      montant, reference: fiche.reference, fournisseurNom: fiche.fournisseur?.nom ?? fiche.beneficiaireNom,
      fournisseurId: fiche.fournisseurId, modePaiement, userId, pointDeVenteId: fiche.pointDeVenteId,
    });
  } else {
    const typeAccepte = ["ACHAT_MARCHANDISES", "FOURNITURES", "AVANCE_CAISSE", "FRAIS_FONCTIONNEMENT", "TRANSPORT", "AUTRES", "SALAIRE", "CARBURANT"].includes(fiche.typeDepense)
      ? (fiche.typeDepense as "ACHAT_MARCHANDISES" | "FOURNITURES" | "AVANCE_CAISSE" | "FRAIS_FONCTIONNEMENT" | "TRANSPORT" | "AUTRES" | "SALAIRE" | "CARBURANT")
      : "AUTRES";
    ecritureId = await ecritureDecaissement(tx, {
      montant, reference: fiche.reference, typeDepense: typeAccepte, beneficiaireNom: fiche.beneficiaireNom,
      modePaiement, userId, pointDeVenteId: fiche.pointDeVenteId,
    });
  }

  // Le Bon de Commande fournisseur lié (si présent) n'est mis à jour qu'à l'exécution effective,
  // pour que montantPaye ne reflète que des paiements réellement décaissés (CDC Approvisionnement §7/§14).
  if (fiche.bonCommandeFournisseurId) {
    await tx.bonCommande.update({ where: { id: fiche.bonCommandeFournisseurId }, data: { montantPaye: { increment: montant } } });
  }
  // Règlement dépôt-vente lié (§5.5) : passe REGLE seulement ici — même logique.
  if (fiche.reglementDepotVenteId) {
    await tx.reglementDepotVente.update({ where: { id: fiche.reglementDepotVenteId }, data: { statut: "REGLE" } });
  }
  return ecritureId;
}

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
    // Fiche rattachée à une sortie de caisse : l'argent est déjà sorti, l'approbation est un
    // contrôle a posteriori (pas d'étape « Exécuter »).
    const lieeACaisse = fiche.operationCaisseId != null || fiche.operationCaissePDVId != null;
    const modeCaisse = (fiche.modePaiement ?? "ESPECES") as "ESPECES" | "MOBILE_MONEY" | "CHEQUE" | "VIREMENT";

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
            signatureN1: signatureTracee(body.signatureN1),
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
        } else if (lieeACaisse) {
          const ecritureId = await appliquerEffetsPaiement(tx, fiche, montantApprouve, modeCaisse, userId);
          await tx.ficheDecaissement.update({ where: { id: ficheId }, data: { ecritureId } });
          await notify(tx, [fiche.demandeurId], {
            titre: `Fiche ${fiche.reference} approuvée`,
            message: `Sortie de caisse validée pour ${montantApprouve.toLocaleString("fr-FR")} FCFA.`,
            priorite: PrioriteNotification.NORMAL,
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
          data: { approbateurN2Id: userId, dateApprobationN2: new Date(), signatureN2: signatureTracee(body.signatureN2), montantApprouve, motifEcartMontant, statut: "APPROUVEE" },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "FD_APPROUVEE_N2", "FicheDecaissement", ficheId, undefined, getRequestMeta(req));
        if (lieeACaisse) {
          const ecritureId = await appliquerEffetsPaiement(tx, fiche, montantApprouve, modeCaisse, userId);
          await tx.ficheDecaissement.update({ where: { id: ficheId }, data: { ecritureId } });
          await notify(tx, [fiche.demandeurId], {
            titre: `Fiche ${fiche.reference} approuvée`,
            message: `Sortie de caisse validée par la Direction pour ${montantApprouve.toLocaleString("fr-FR")} FCFA.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/user/decaissements?detail=${ficheId}`,
          });
          return f;
        }
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
      if (lieeACaisse) {
        return NextResponse.json({ error: "Cette fiche est rattachée à une sortie de caisse déjà effectuée : il n'y a pas d'exécution à faire" }, { status: 422 });
      }
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

      // Décaissement en espèces : la sortie de fonds passe par la grande caisse de l'exécutant
      // (sortie de caisse créée ici, rattachée à la fiche) — la caisse est ainsi débitée et
      // l'écriture comptable est celle de la sortie (pas de double comptage). Hors espèces
      // (mobile money, chèque, virement) ou sans session de caisse ouverte : écriture directe.
      const estAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
      const sessionCaisse = modePaiement === "ESPECES"
        ? await prisma.sessionCaisse.findFirst({
            where: { statut: "OUVERTE", ...(estAdmin ? {} : { caissierId: userId }) },
            orderBy: { createdAt: "desc" },
          })
        : null;
      if (modePaiement === "ESPECES" && !sessionCaisse && (await getCaissierSession())) {
        return NextResponse.json({ error: "Aucune session de caisse ouverte : ouvrez d'abord la caisse pour décaisser en espèces." }, { status: 409 });
      }

      const updated = await prisma.$transaction(async (tx) => {
        let ficheEffets: FicheEffets = fiche;
        if (sessionCaisse) {
          const d = new Date();
          const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
          const op = await tx.operationCaisse.create({
            data: {
              sessionId: sessionCaisse.id, type: "DECAISSEMENT", origine: "SAISIE_MANUELLE",
              categorie: CATEGORIE_CAISSE[fiche.typeDepense] ?? "AUTRE",
              montant: new Prisma.Decimal(montant),
              motif: `${fiche.reference} — ${fiche.motif}`.slice(0, 250),
              reference: `DEC-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`,
              operateurNom: session.user.name ?? `${session.user.prenom} ${session.user.nom}`,
              operateurId: userId,
            },
          });
          ficheEffets = { ...fiche, operationCaisseId: op.id };
        }
        const ecritureId = await appliquerEffetsPaiement(tx, ficheEffets, montant, modePaiement, userId);

        const f = await tx.ficheDecaissement.update({
          where: { id: ficheId },
          data: {
            operationCaisseId: ficheEffets.operationCaisseId,
            statut: "PAYEE", executeParId: userId, dateExecution: new Date(),
            modePaiement, referencePaiement,
            beneficiaireConfirmationNom, beneficiaireConfirmationPiece: body.beneficiaireConfirmationPiece || null,
            dateConfirmationBeneficiaire: new Date(),
            signatureExecutant: signatureTracee(body.signatureExecutant),
            signatureBeneficiaire: signatureTracee(body.signatureBeneficiaire),
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
