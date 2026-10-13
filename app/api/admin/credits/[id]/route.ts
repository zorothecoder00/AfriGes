import { NextResponse } from "next/server";
import { StatutCredit, StatutEcheanceCredit, TypeMouvement, TypeEntreeStock } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCorrectionCreditSession, creditDansPerimetre } from "@/lib/authRVC";
import { notifyAdmins } from "@/lib/notifications";
import { supprimerTransactionClient } from "@/lib/clientTransaction";
import { montantJournalierArrondi } from "@/lib/echeancierCredit";
import { resolveRvcPdv } from "@/lib/gestionnaireCredit";
import { tariferLigne } from "@/lib/venteTarification";

type Ctx = { params: Promise<{ id: string }> };

/**
 * ==========================
 * GET /api/admin/credits/[id]
 * ==========================
 * Détail complet d'un crédit
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const acces = await getCorrectionCreditSession();
    if (!acces) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const credit = await prisma.creditClient.findUnique({
      where: { id: creditId },
      include: {
        client:   { select: {
          id: true, nom: true, prenom: true, codeClient: true, telephone: true, niveauRisque: true, limiteCredit: true, soldeActuel: true,
          sexe: true, adresse: true, quartier: true, activite: true, nomCommerce: true, numeroCNI: true, numeroCarteAfrisime: true,
          agentTerrain:  { select: { nom: true, prenom: true, telephone: true } },
          pointDeVente:  { select: { nom: true, code: true } },
          pointsDeVente: { select: { pointDeVente: { select: { nom: true, code: true } } } },
        } },
        creePar:  { select: { id: true, nom: true, prenom: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
        gestionnaireCredit: { select: { id: true, nom: true, prenom: true } },
        lignes: {
          orderBy: { id: "asc" },
          include: {
            produit:          { select: { id: true, nom: true, reference: true } },
            produitSubstitut: { select: { id: true, nom: true } },
            traitePar:        { select: { id: true, nom: true, prenom: true } },
          },
        },
        echeances: {
          orderBy: { numeroEcheance: "asc" },
        },
        remboursements: {
          orderBy: { dateRemboursement: "desc" },
          include: {
            enregistrePar:   { select: { id: true, nom: true, prenom: true } },
            agentCollecteur: { select: { id: true, nom: true, prenom: true } },
          },
        },
      },
    });

    if (!credit) return NextResponse.json({ message: "Crédit introuvable" }, { status: 404 });
    if (!creditDansPerimetre(acces.pdvIds, credit.pointDeVenteId)) {
      return NextResponse.json({ message: "Ce crédit n'appartient pas à votre point de vente" }, { status: 403 });
    }

    const rvcPdv = await resolveRvcPdv(credit.pointDeVenteId);
    return NextResponse.json({ data: { ...credit, rvcPdv } });
  } catch (error) {
    console.error("GET /api/admin/credits/[id]", error);
    return NextResponse.json({ message: "Erreur lors de la récupération du crédit" }, { status: 500 });
  }
}

/**
 * ==========================
 * PATCH /api/admin/credits/[id]
 * ==========================
 * Modifier un crédit, quel que soit son statut (en cours / soldé : échéancier régénéré
 * et statut recalculé ; rejeté / annulé : champs descriptifs seulement)
 *
 * Body: {
 *   lignes?, dureeJours?, dateDebut?,
 *   tauxPenalite?, garantie?, observations?
 * }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const acces = await getCorrectionCreditSession();
    if (!acces) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    const { session } = acces;

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { lignes, dureeJours, dateDebut, tauxPenalite, garantie, observations, gestionnaireCreditId,
      fraisDossier, assurance, autresFrais, fraisLivraison, tauxInteret, delaiGraceJours,
      garantNom, garantTelephone, garantAdresse, garantTypeGarantie, garantValeurEstimee } = body;

    const result = await prisma.$transaction(async (tx) => {
      const credit = await tx.creditClient.findUnique({
        where: { id: creditId },
        include: {
          lignes: { select: { produitId: true, quantite: true, statut: true } },
          _count: { select: { financementsRIA: true } },
        },
      });
      if (!credit) throw new Error("CREDIT_INTROUVABLE");
      if (!creditDansPerimetre(acces.pdvIds, credit.pointDeVenteId)) throw new Error("HORS_PERIMETRE");

      // « En cours » = ACTIF, EN_RETARD ou SOLDE : l'échéancier existe et peut être
      // régénéré (avec réimputation du déjà-payé). SOLDE inclus pour corriger un crédit
      // soldé à tort (mauvais montant saisi) : le statut est recalculé plus bas.
      const estActif = credit.statut === StatutCredit.ACTIF || credit.statut === StatutCredit.EN_RETARD
        || credit.statut === StatutCredit.SOLDE;
      // Crédits clos sans effet financier (REJETE / ANNULE) : seuls les champs
      // descriptifs (garantie, observations, gestionnaire…) restent modifiables.
      const estClos = credit.statut === StatutCredit.REJETE || credit.statut === StatutCredit.ANNULE;

      const toucheFrais    = fraisDossier !== undefined || assurance !== undefined || autresFrais !== undefined || fraisLivraison !== undefined || tauxInteret !== undefined;
      const toucheMontant  = lignes !== undefined || toucheFrais;
      const touchePlanning = dureeJours !== undefined || dateDebut !== undefined;
      const dejaRembourse  = Number(credit.montantRembourse);

      if (estClos && (toucheMontant || touchePlanning)) throw new Error("CREDIT_CLOS");

      // Sur un crédit en cours, remplacer les LIGNES casserait le suivi des produits déjà
      // livrés, et un changement de MONTANT désynchroniserait un financement RIA.
      // Les remboursements, eux, ne bloquent plus : le déjà-payé est réimputé sur le
      // nouvel échéancier et le solde client corrigé du delta.
      if (estActif && lignes !== undefined && credit.lignes.some((l) => l.statut === "LIVRE")) {
        throw new Error("ACTIF_LIGNE_LIVREE");
      }
      if (estActif && toucheMontant && credit._count.financementsRIA > 0) throw new Error("ACTIF_FINANCE_RIA");

      const ancienMontant = Number(credit.montantTotal);
      let montantTotal = ancienMontant;
      let montantInteret = Number(credit.montantInteret);

      if (lignes !== undefined) {
        if (!Array.isArray(lignes) || lignes.length === 0) throw new Error("LIGNES_INVALIDES");

        // Prix CRÉDIT résolu depuis le catalogue (§4) pour les produits référencés —
        // autoritaire (§15) ; les produits saisis libres gardent le prix fourni.
        const lignesCalculees = await Promise.all((lignes as {
          produitId?: number;
          produitNom: string;
          quantite: number;
          prixUnitaire: number;
          remise?: number;
        }[]).map(async (l) => {
          const qte = Number(l.quantite);
          const rem = Number(l.remise || 0);
          let pu    = Number(l.prixUnitaire);
          if (l.produitId) {
            const produit = await tx.produit.findUnique({
              where: { id: Number(l.produitId) },
              select: { id: true, prixUnitaire: true, categorieId: true, familleId: true, marqueId: true },
            });
            if (produit) {
              const tarif = await tariferLigne(produit, qte, { pointDeVenteId: credit.pointDeVenteId, aCredit: true });
              pu = tarif.prixUnitaire;
            }
          }
          return { ...l, qte, pu, rem, montantLigne: Number((pu * qte - rem).toFixed(2)) };
        }));

        montantTotal = Number(lignesCalculees.reduce((s, l) => s + l.montantLigne, 0).toFixed(2));
        if (montantTotal <= 0) throw new Error("MONTANT_INVALIDE");

        // Libère les réservations des anciennes lignes encore réservées (EN_ATTENTE)
        if (credit.pointDeVenteId) {
          for (const l of credit.lignes) {
            if (l.produitId && l.statut === "EN_ATTENTE") {
              await tx.stockSite.updateMany({
                where: { produitId: l.produitId, pointDeVenteId: credit.pointDeVenteId },
                data:  { quantiteReservee: { decrement: l.quantite } },
              });
            }
          }
        }

        await tx.ligneCreditClient.deleteMany({ where: { creditId } });
        await tx.ligneCreditClient.createMany({
          data: lignesCalculees.map((l) => ({
            creditId,
            produitId:        l.produitId ? Number(l.produitId) : null,
            produitNom:       l.produitNom,
            produitNomSaisi:  l.produitNom,
            quantite:         l.qte,
            prixUnitaire:     l.pu,
            remise:           l.rem,
            montantLigne:     l.montantLigne,
            statut:           "EN_ATTENTE" as const,
            estNouveauProduit: !l.produitId,
            pointDeVenteId:   credit.pointDeVenteId,
          })),
        });

        // Réserve les nouvelles lignes
        if (credit.pointDeVenteId) {
          for (const l of lignesCalculees) {
            if (!l.produitId) continue;
            await tx.stockSite.upsert({
              where: { produitId_pointDeVenteId: { produitId: Number(l.produitId), pointDeVenteId: credit.pointDeVenteId } },
              update: { quantiteReservee: { increment: l.qte } },
              create: { produitId: Number(l.produitId), pointDeVenteId: credit.pointDeVenteId, quantite: 0, quantiteReservee: l.qte },
            });
          }
        }
      }

      // ── Frais / assurance / intérêts → recomposition du montant total ──────
      if (toucheFrais || lignes !== undefined) {
        const fraisD  = fraisDossier   !== undefined ? Math.max(0, Number(fraisDossier))   : Number(credit.fraisDossier);
        const assur   = assurance      !== undefined ? Math.max(0, Number(assurance))      : Number(credit.assurance);
        const autres  = autresFrais    !== undefined ? Math.max(0, Number(autresFrais))    : Number(credit.autresFrais);
        const fraisLiv = fraisLivraison !== undefined ? Math.max(0, Number(fraisLivraison)) : Number(credit.fraisLivraison);
        const tauxInt = tauxInteret    !== undefined ? Math.max(0, Number(tauxInteret))    : Number(credit.tauxInteret);
        // Valeur produits = somme des lignes si modifiées, sinon montant actuel − frais actuels.
        const ancienFraisTotal = Number(credit.fraisDossier) + Number(credit.assurance) + Number(credit.autresFrais) + Number(credit.fraisLivraison) + Number(credit.montantInteret);
        const valeurProduits = lignes !== undefined ? montantTotal : Number((ancienMontant - ancienFraisTotal).toFixed(2));
        montantInteret = Number((valeurProduits * tauxInt / 100).toFixed(2));
        montantTotal   = Number((valeurProduits + fraisD + assur + autres + fraisLiv + montantInteret).toFixed(2));
        if (montantTotal <= 0) throw new Error("MONTANT_INVALIDE");
      }
      if (estActif && toucheMontant && montantTotal + 0.01 < dejaRembourse) throw new Error("MONTANT_INFERIEUR_REMBOURSE");

      // ── Recalcul de l'échéancier ──────────────────────────────────────────
      const duree = dureeJours !== undefined ? Number(dureeJours) : credit.dureeJours;
      if (duree < 1) throw new Error("DUREE_INVALIDE");

      const debut = dateDebut !== undefined ? new Date(dateDebut) : credit.dateDebut;
      const montantJournalier = montantJournalierArrondi(montantTotal, duree);
      const dateEcheanceFin   = new Date(debut);
      dateEcheanceFin.setDate(dateEcheanceFin.getDate() + duree);

      // soldeRestant = montant total − déjà remboursé (le déjà-payé est préservé)
      const soldeRestant = Math.max(0, Number((montantTotal - dejaRembourse).toFixed(2)));

      const updated = await tx.creditClient.update({
        where: { id: creditId },
        data: {
          ...(!estClos && {
            montantTotal,
            soldeRestant,
            dureeJours: duree,
            dateDebut:  debut,
            dateEcheanceFin,
            montantJournalier,
          }),
          ...(toucheFrais && { montantInteret }),
          ...(fraisDossier   !== undefined && { fraisDossier:   Math.max(0, Number(fraisDossier)) }),
          ...(assurance      !== undefined && { assurance:      Math.max(0, Number(assurance)) }),
          ...(autresFrais    !== undefined && { autresFrais:    Math.max(0, Number(autresFrais)) }),
          ...(fraisLivraison !== undefined && { fraisLivraison: Math.max(0, Number(fraisLivraison)) }),
          ...(tauxInteret    !== undefined && { tauxInteret:    Math.max(0, Number(tauxInteret)) }),
          ...(delaiGraceJours !== undefined && { delaiGraceJours: Math.max(0, Number(delaiGraceJours)) }),
          ...(tauxPenalite  !== undefined && { tauxPenalite:  Number(tauxPenalite) }),
          ...(garantie      !== undefined && { garantie:      garantie || null }),
          ...(garantNom          !== undefined && { garantNom:          garantNom || null }),
          ...(garantTelephone    !== undefined && { garantTelephone:    garantTelephone || null }),
          ...(garantAdresse      !== undefined && { garantAdresse:      garantAdresse || null }),
          ...(garantTypeGarantie !== undefined && { garantTypeGarantie: garantTypeGarantie || null }),
          ...(garantValeurEstimee !== undefined && { garantValeurEstimee: Math.max(0, Number(garantValeurEstimee)) }),
          ...(observations  !== undefined && { observations:  observations || null }),
          ...(gestionnaireCreditId !== undefined && { gestionnaireCreditId: gestionnaireCreditId ? Number(gestionnaireCreditId) : null }),
        },
      });

      // ── Crédit ACTIF : répercuter le delta de montant + régénérer l'échéancier ──
      if (estActif && (toucheMontant || touchePlanning)) {
        // Répercussion d'un éventuel changement de montant sur le solde client
        const delta = Number((montantTotal - ancienMontant).toFixed(2));
        if (delta !== 0) {
          await tx.client.update({
            where: { id: credit.clientId },
            data:  { soldeActuel: { increment: delta } },
          });
        }

        // Régénération complète : on réimpute le déjà-remboursé sur le nouvel échéancier
        // (depuis la 1re échéance), pour rester cohérent même si le crédit a des paiements.
        await tx.echeanceCredit.deleteMany({ where: { creditId } });
        const residuel = Number((montantTotal - montantJournalier * duree).toFixed(2));
        const now = new Date();
        let budget = dejaRembourse;     // total déjà payé à réimputer
        let resteEnRetard = false;
        const echData = Array.from({ length: duree }, (_, idx) => {
          const i = idx + 1;
          const d = new Date(debut);
          d.setDate(d.getDate() + idx);
          const montantDu = i === duree
            ? Number((montantJournalier + residuel).toFixed(2))
            : montantJournalier;
          const paye = Math.min(budget, montantDu);
          budget = Number((budget - paye).toFixed(2));
          // On ne marque jamais EN_RETARD ici : une échéance EN_RETARD serait exclue de
          // l'imputation des futurs remboursements. Le retard est porté par le crédit.
          const statut = paye >= montantDu
            ? StatutEcheanceCredit.PAYE
            : paye > 0 ? StatutEcheanceCredit.PARTIEL : StatutEcheanceCredit.EN_ATTENTE;
          if (paye < montantDu && d < now) resteEnRetard = true;
          return { creditId, numeroEcheance: i, dateEcheance: d, montantDu, montantPaye: paye, statut };
        });
        await tx.echeanceCredit.createMany({ data: echData });

        // Statut crédit recalculé : SOLDE si tout payé, sinon EN_RETARD / ACTIF
        const nouveauStatut = soldeRestant <= 0
          ? StatutCredit.SOLDE
          : resteEnRetard ? StatutCredit.EN_RETARD : StatutCredit.ACTIF;
        if (nouveauStatut !== credit.statut) {
          await tx.creditClient.update({ where: { id: creditId }, data: { statut: nouveauStatut } });
        }
      }

      await tx.auditLog.create({
        data: {
          action: "MODIFICATION_CREDIT",
          entite: "CreditClient",
          entiteId: creditId,
          userId: Number(session.user.id),
        },
      });

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    console.error("PATCH /api/admin/credits/[id]", error);
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CREDIT_INTROUVABLE:   ["Crédit introuvable", 404],
        HORS_PERIMETRE:       ["Ce crédit n'appartient pas à votre point de vente", 403],
        CREDIT_CLOS:          ["Crédit rejeté ou annulé : seuls garantie, observations et gestionnaire sont modifiables.", 422],
        MONTANT_INFERIEUR_REMBOURSE: ["Le nouveau montant est inférieur à ce que le client a déjà remboursé : corrigez ou supprimez d'abord les remboursements en trop.", 422],
        ACTIF_LIGNE_LIVREE:   ["Crédit avec produit(s) déjà livré(s) : les lignes de produits ne sont plus modifiables (frais, durée et dates restent corrigeables).", 422],
        ACTIF_FINANCE_RIA:    ["Crédit actif financé par un portefeuille RIA : montant non modifiable.", 422],
        LIGNES_INVALIDES:     ["Les lignes de produits sont invalides", 400],
        MONTANT_INVALIDE:     ["Le montant total doit être positif", 400],
        DUREE_INVALIDE:       ["La durée doit être d'au moins 1 jour", 400],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ message: msg }, { status });
      }
    }

    return NextResponse.json({ message: "Erreur lors de la modification du crédit" }, { status: 500 });
  }
}

/**
 * ==========================
 * DELETE /api/admin/credits/[id]
 * ==========================
 * Supprime un crédit, quel que soit son statut (y compris SOLDE / EN_RETARD : crédit
 * saisi ou soldé par erreur). Réverse proprement ses effets avant suppression :
 *   - libère / restaure le stock réservé ou livré (par ligne)
 *   - décrémente client.soldeActuel du solde restant (crédit en cours)
 *   - efface les transactions client des remboursements confirmés
 * Bloqué si le crédit porte des opérations liées (livraisons, factures, financements RIA)
 * ou des remboursements issus d'une collecte terrain / d'un compte courant (argent
 * engagé ailleurs : à supprimer d'abord un par un).
 * Lignes / échéances / remboursements partent en cascade (schéma).
 */
const STATUTS_EN_COURS: StatutCredit[] = [
  StatutCredit.ACTIF,
  StatutCredit.EN_RETARD,
  StatutCredit.SOLDE,
];

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const acces = await getCorrectionCreditSession();
    if (!acces) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    const { session } = acces;

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      const credit = await tx.creditClient.findUnique({
        where: { id: creditId },
        include: {
          lignes: { select: { produitId: true, quantite: true, prixUnitaire: true, statut: true } },
          remboursements: { select: { id: true, statut: true, compteCourantId: true, ligneCollecte: { select: { id: true } } } },
          _count: { select: { livraisons: true, facturesVente: true, financementsRIA: true } },
        },
      });
      if (!credit) throw new Error("CREDIT_INTROUVABLE");
      if (!creditDansPerimetre(acces.pdvIds, credit.pointDeVenteId)) throw new Error("HORS_PERIMETRE");
      if (credit._count.livraisons > 0 || credit._count.facturesVente > 0 || credit._count.financementsRIA > 0) {
        throw new Error("CREDIT_LIE");
      }
      if (credit.remboursements.some((r) => r.compteCourantId || r.ligneCollecte)) {
        throw new Error("REMBOURSEMENT_LIE");
      }

      const estActif = STATUTS_EN_COURS.includes(credit.statut);

      // ── Remboursements confirmés : on retire leurs traces côté client ──────
      // (le solde client est corrigé globalement ci-dessous via soldeRestant).
      for (const r of credit.remboursements) {
        if (r.statut === "CONFIRME") {
          await supprimerTransactionClient(tx, { sourceType: "REMBOURSEMENT_CREDIT", sourceId: r.id });
        }
      }

      // ── Réversion du stock réservé / livré (comme une annulation) ──────────
      if (credit.pointDeVenteId) {
        for (const ligne of credit.lignes) {
          if (!ligne.produitId) continue;
          if (ligne.statut === "LIVRE") {
            // Restauration physique (le stock avait été décrémenté à la livraison)
            const dateStr = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
            await tx.stockSite.updateMany({
              where: { produitId: ligne.produitId, pointDeVenteId: credit.pointDeVenteId },
              data:  { quantite: { increment: ligne.quantite } },
            });
            await tx.mouvementStock.create({
              data: {
                produitId:      ligne.produitId,
                pointDeVenteId: credit.pointDeVenteId,
                type:           TypeMouvement.ENTREE,
                typeEntree:     TypeEntreeStock.RETOUR_CLIENT,
                quantite:       ligne.quantite,
                prixUnitaire:   ligne.prixUnitaire,
                motif:          `Suppression crédit — ${credit.reference}`,
                reference:      `MVT-SUP-${creditId}-P${ligne.produitId}-${dateStr}`,
                operateurId:    Number(session.user.id),
              },
            });
          } else if (ligne.statut === "EN_ATTENTE") {
            // Réservation à libérer (créée à la création ou à la validation)
            await tx.stockSite.updateMany({
              where: { produitId: ligne.produitId, pointDeVenteId: credit.pointDeVenteId },
              data:  { quantiteReservee: { decrement: ligne.quantite } },
            });
          }
          // INDISPONIBLE / SUBSTITUE / ANNULE → réservation déjà libérée
        }
      }

      // ── Réversion du solde client (le crédit actif l'avait incrémenté) ─────
      if (estActif && Number(credit.soldeRestant) > 0) {
        await tx.client.update({
          where: { id: credit.clientId },
          data:  { soldeActuel: { decrement: Number(credit.soldeRestant) } },
        });
      }

      await tx.creditClient.delete({ where: { id: creditId } }); // cascade lignes/échéances/remboursements

      await tx.auditLog.create({
        data: {
          action: "SUPPRESSION_CREDIT",
          entite: "CreditClient",
          entiteId: creditId,
          userId: Number(session.user.id),
        },
      });

      // Suppression faite par un RPV (hors circuit crédit) → information de la Direction.
      if (acces.estRPV) {
        const auteur = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();
        await notifyAdmins(tx, {
          titre: `Crédit supprimé par le RPV — ${credit.reference}`,
          message: `${auteur} a supprimé le crédit ${credit.reference} (${Number(credit.montantTotal).toLocaleString("fr-FR")} FCFA).`,
          priorite: "HAUTE",
          actionUrl: "/dashboard/admin/credits",
        });
      }
    });

    return NextResponse.json({ message: "Crédit supprimé" });
  } catch (error: unknown) {
    console.error("DELETE /api/admin/credits/[id]", error);
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CREDIT_INTROUVABLE:    ["Crédit introuvable", 404],
        HORS_PERIMETRE:        ["Ce crédit n'appartient pas à votre point de vente", 403],
        CREDIT_LIE:            ["Ce crédit est lié à des opérations (livraisons, factures ou financements) — suppression impossible", 422],
        REMBOURSEMENT_LIE:     ["Ce crédit a des remboursements issus d'une collecte terrain ou d'un compte courant — supprimez-les d'abord un par un (fiche du crédit)", 422],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ message: msg }, { status });
      }
    }
    return NextResponse.json({ message: "Erreur lors de la suppression du crédit" }, { status: 500 });
  }
}
