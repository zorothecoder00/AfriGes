import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { StatutLigneCreditClient, TypeMouvement, TypeSortieStock } from "@prisma/client";
import { auditLog } from "@/lib/notifications";

// ─── helpers ──────────────────────────────────────────────────────────────────

async function getRvcPdvId(userId: number, isAdmin: boolean): Promise<number | null> {
  if (isAdmin) return null;
  const aff = await prisma.gestionnaireAffectation.findFirst({
    where: { userId, actif: true },
    select: { pointDeVenteId: true },
  });
  return aff?.pointDeVenteId ?? null;
}

async function recalcCredit(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], creditId: number) {
  const allLignes = await tx.ligneCreditClient.findMany({
    where: { creditId },
    select: { montantLigne: true },
  });
  const newTotal = Number(allLignes.reduce((s, l) => s + Number(l.montantLigne), 0).toFixed(2));
  const credit = await tx.creditClient.findUnique({
    where: { id: creditId },
    select: { dureeJours: true, dateDebut: true },
  });
  if (!credit) return;
  const montantJournalier = Number((newTotal / credit.dureeJours).toFixed(2));
  const dateEcheanceFin   = new Date(credit.dateDebut);
  dateEcheanceFin.setDate(dateEcheanceFin.getDate() + credit.dureeJours);
  await tx.creditClient.update({
    where: { id: creditId },
    data: { montantTotal: newTotal, soldeRestant: newTotal, montantJournalier, dateEcheanceFin },
  });
}

type Ctx = { params: Promise<{ id: string; ligneId: string }> };

/**
 * PATCH /api/rvc/credits/[id]/lignes/[ligneId]
 *
 * Met à jour le statut d'une ligne de crédit (livraison, indisponibilité, substitution, annulation).
 *
 * Body:
 *   { statut: "LIVRE" | "INDISPONIBLE" | "SUBSTITUE" | "ANNULE", notes?, produitSubstitutId? }
 *
 * Règles :
 *  - SUBSTITUE requiert produitSubstitutId
 *  - Seules les lignes EN_ATTENTE peuvent être mises à jour (sauf ANNULE depuis n'importe quel statut non LIVRE)
 *  - Le crédit doit appartenir au PDV du RVC
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, ligneId } = await params;
    const creditId = Number(id);
    const ligneIdN = Number(ligneId);
    if (isNaN(creditId) || isNaN(ligneIdN)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    let rvcPdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff) return NextResponse.json({ error: "Aucun PDV associé" }, { status: 400 });
      rvcPdvId = aff.pointDeVenteId;
    }

    const body = await req.json() as {
      statut: StatutLigneCreditClient;
      notes?: string;
      produitSubstitutId?: number;
    };

    const { statut, notes, produitSubstitutId } = body;

    const STATUTS_VALIDES: StatutLigneCreditClient[] = ["LIVRE", "INDISPONIBLE", "SUBSTITUE", "ANNULE"];
    if (!STATUTS_VALIDES.includes(statut)) {
      return NextResponse.json({ error: `Statut invalide. Valeurs acceptées : ${STATUTS_VALIDES.join(", ")}` }, { status: 400 });
    }
    if (statut === "SUBSTITUE" && !produitSubstitutId) {
      return NextResponse.json({ error: "produitSubstitutId est requis pour une substitution" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const ligne = await tx.ligneCreditClient.findUnique({
        where: { id: ligneIdN },
        include: { credit: { select: { id: true, pointDeVenteId: true, reference: true } } },
      });
      if (!ligne) throw new Error("LIGNE_INTROUVABLE");
      if (ligne.creditId !== creditId) throw new Error("LIGNE_INTROUVABLE");

      // Scope PDV
      if (rvcPdvId !== null && ligne.credit.pointDeVenteId !== rvcPdvId) {
        throw new Error("ACCES_REFUSE");
      }

      // Transitions autorisées
      if (ligne.statut === "LIVRE") throw new Error("LIGNE_DEJA_LIVREE");
      if (statut !== "ANNULE" && ligne.statut !== "EN_ATTENTE") {
        throw new Error("TRANSITION_INVALIDE");
      }

      // Vérifier produit substitut si fourni
      if (produitSubstitutId) {
        const produit = await tx.produit.findUnique({ where: { id: produitSubstitutId }, select: { id: true } });
        if (!produit) throw new Error("PRODUIT_SUBSTITUT_INTROUVABLE");
      }

      const result = await tx.ligneCreditClient.update({
        where: { id: ligneIdN },
        data: {
          statut,
          notes:             notes ?? ligne.notes,
          produitSubstitutId: statut === "SUBSTITUE" ? produitSubstitutId : ligne.produitSubstitutId,
          traiteParId:       userId,
          dateTraitement:    new Date(),
        },
        include: {
          produit:          { select: { id: true, nom: true } },
          produitSubstitut: { select: { id: true, nom: true } },
        },
      });

      await auditLog(tx, userId, `LIGNE_CREDIT_${statut}`, "LigneCreditClient", ligneIdN);

      // ── Mouvement de stock ────────────────────────────────────────────────
      const pdvId = ligne.credit.pointDeVenteId;
      const prevStatut = ligne.statut; // statut AVANT la mise à jour

      if (ligne.produitId && pdvId) {
        if (statut === "LIVRE" && prevStatut === "EN_ATTENTE") {
          // Livraison physique : décrémente quantite + libère la réservation
          await tx.stockSite.updateMany({
            where: { produitId: ligne.produitId, pointDeVenteId: pdvId },
            data: {
              quantite:         { decrement: ligne.quantite },
              quantiteReservee: { decrement: ligne.quantite },
            },
          });
          const dateStr = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
          await tx.mouvementStock.create({
            data: {
              produitId:      ligne.produitId,
              pointDeVenteId: pdvId,
              type:           TypeMouvement.SORTIE,
              typeSortie:     TypeSortieStock.LIVRAISON_CLIENT,
              quantite:       ligne.quantite,
              prixUnitaire:   ligne.prixUnitaire,
              motif:          `Livraison crédit — ${ligne.credit.reference}`,
              reference:      `MVT-LIV-${creditId}-L${ligneIdN}-${dateStr}`,
              operateurId:    userId,
            },
          });
        } else if (prevStatut === "EN_ATTENTE" && (statut === "INDISPONIBLE" || statut === "SUBSTITUE" || statut === "ANNULE")) {
          // Produit non livré : libère uniquement la réservation
          await tx.stockSite.updateMany({
            where: { produitId: ligne.produitId, pointDeVenteId: pdvId },
            data: { quantiteReservee: { decrement: ligne.quantite } },
          });
        }
        // ANNULE depuis SUBSTITUE/INDISPONIBLE : réservation déjà libérée, rien à faire
      }

      return result;
    });

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        LIGNE_INTROUVABLE:            ["Ligne introuvable", 404],
        ACCES_REFUSE:                 ["Accès refusé — PDV non autorisé", 403],
        LIGNE_DEJA_LIVREE:            ["Cette ligne est déjà marquée comme livrée", 409],
        TRANSITION_INVALIDE:          ["Seules les lignes EN_ATTENTE peuvent changer de statut (sauf ANNULE)", 409],
        PRODUIT_SUBSTITUT_INTROUVABLE:["Produit substitut introuvable", 404],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ error: msg }, { status });
      }
    }
    console.error("PATCH /api/rvc/credits/[id]/lignes/[ligneId]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PUT /api/rvc/credits/[id]/lignes/[ligneId]
 *
 * Modifie le contenu d'une ligne (produit, quantité, prix) d'un crédit EN_ATTENTE_VALIDATION.
 * Body: { produitId?, produitNomSaisi?, quantite?, prixUnitaire?, remise? }
 */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, ligneId } = await params;
    const creditId = Number(id);
    const ligneIdN = Number(ligneId);
    if (isNaN(creditId) || isNaN(ligneIdN)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const rvcPdvId = await getRvcPdvId(userId, isAdmin);
    if (!isAdmin && rvcPdvId === null) {
      return NextResponse.json({ error: "Aucun PDV associé" }, { status: 400 });
    }

    const body = await req.json();
    const { produitId, produitNomSaisi, quantite, prixUnitaire, remise } = body;

    const result = await prisma.$transaction(async (tx) => {
      const ligne = await tx.ligneCreditClient.findUnique({
        where: { id: ligneIdN },
        include: { credit: { select: { id: true, statut: true, pointDeVenteId: true } } },
      });
      if (!ligne || ligne.creditId !== creditId) throw new Error("LIGNE_INTROUVABLE");
      if (ligne.credit.statut !== "EN_ATTENTE_VALIDATION") throw new Error("CREDIT_NON_MODIFIABLE");
      if (rvcPdvId !== null && ligne.credit.pointDeVenteId !== rvcPdvId) throw new Error("ACCES_REFUSE");

      const qte = quantite != null ? Number(quantite) : ligne.quantite;
      const pu  = prixUnitaire != null ? Number(prixUnitaire) : Number(ligne.prixUnitaire);
      const rem = remise != null ? Number(remise) : Number(ligne.remise);
      const montantLigne = Number((pu * qte - rem).toFixed(2));

      let nomProduit = produitNomSaisi ?? ligne.produitNom;
      let newProduitId: number | null = ligne.produitId;
      if (produitId != null) {
        const produit = await tx.produit.findUnique({
          where: { id: Number(produitId) },
          select: { nom: true },
        });
        if (!produit) throw new Error("PRODUIT_INTROUVABLE");
        nomProduit = produit.nom;
        newProduitId = Number(produitId);
      } else if (produitId === null) {
        // Explicit null → switch to hors-catalogue
        newProduitId = null;
        nomProduit = produitNomSaisi ?? ligne.produitNomSaisi ?? ligne.produitNom;
      }

      const updated = await tx.ligneCreditClient.update({
        where: { id: ligneIdN },
        data: {
          produitId:         newProduitId,
          produitNom:        nomProduit,
          produitNomSaisi:   produitNomSaisi ?? ligne.produitNomSaisi,
          quantite:          qte,
          prixUnitaire:      pu,
          remise:            rem,
          montantLigne,
          estNouveauProduit: newProduitId === null,
        },
      });

      await recalcCredit(tx, creditId);
      await auditLog(tx, userId, "LIGNE_CREDIT_MODIFIEE_RVC", "LigneCreditClient", ligneIdN);
      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        LIGNE_INTROUVABLE:    ["Ligne introuvable", 404],
        CREDIT_NON_MODIFIABLE:["Seuls les crédits EN_ATTENTE_VALIDATION peuvent être modifiés", 422],
        ACCES_REFUSE:         ["Accès refusé — PDV non autorisé", 403],
        PRODUIT_INTROUVABLE:  ["Produit introuvable", 404],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ error: msg }, { status });
      }
    }
    console.error("PUT /api/rvc/credits/[id]/lignes/[ligneId]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/rvc/credits/[id]/lignes/[ligneId]
 *
 * Supprime une ligne d'un crédit EN_ATTENTE_VALIDATION et recalcule le total.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, ligneId } = await params;
    const creditId = Number(id);
    const ligneIdN = Number(ligneId);
    if (isNaN(creditId) || isNaN(ligneIdN)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const rvcPdvId = await getRvcPdvId(userId, isAdmin);
    if (!isAdmin && rvcPdvId === null) {
      return NextResponse.json({ error: "Aucun PDV associé" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const ligne = await tx.ligneCreditClient.findUnique({
        where: { id: ligneIdN },
        include: { credit: { select: { id: true, statut: true, pointDeVenteId: true } } },
      });
      if (!ligne || ligne.creditId !== creditId) throw new Error("LIGNE_INTROUVABLE");
      if (ligne.credit.statut !== "EN_ATTENTE_VALIDATION") throw new Error("CREDIT_NON_MODIFIABLE");
      if (rvcPdvId !== null && ligne.credit.pointDeVenteId !== rvcPdvId) throw new Error("ACCES_REFUSE");

      // Empêcher la suppression de la dernière ligne
      const count = await tx.ligneCreditClient.count({ where: { creditId } });
      if (count <= 1) throw new Error("DERNIERE_LIGNE");

      await tx.ligneCreditClient.delete({ where: { id: ligneIdN } });
      await recalcCredit(tx, creditId);
      await auditLog(tx, userId, "LIGNE_CREDIT_SUPPRIMEE_RVC", "CreditClient", creditId);
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        LIGNE_INTROUVABLE:    ["Ligne introuvable", 404],
        CREDIT_NON_MODIFIABLE:["Seuls les crédits EN_ATTENTE_VALIDATION peuvent être modifiés", 422],
        ACCES_REFUSE:         ["Accès refusé — PDV non autorisé", 403],
        DERNIERE_LIGNE:       ["Impossible de supprimer la dernière ligne du crédit", 422],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ error: msg }, { status });
      }
    }
    console.error("DELETE /api/rvc/credits/[id]/lignes/[ligneId]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
