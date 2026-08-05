import { NextResponse } from "next/server";
import { PrioriteNotification, StatutBonSortie, TypeSortieStock } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { requirePermission } from "@/lib/permissions";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { comptabiliserBonSortie } from "@/lib/comptabilite/ecrituresBonSortie";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/magasinier/bons-sortie/[id]
 * Détail d'un bon de sortie
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const { id } = await params;
    const bonId = Number(id);
    if (isNaN(bonId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const bon = await prisma.bonSortie.findUnique({
      where: { id: bonId },
      include: {
        lignes: {
          include: { produit: { select: { id: true, nom: true, prixUnitaire: true } } },
        },
        creePar:  { select: { id: true, nom: true, prenom: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (!bon) return NextResponse.json({ error: "Bon introuvable" }, { status: 404 });

    return NextResponse.json({ data: bon });
  } catch (error) {
    console.error("GET /magasinier/bons-sortie/[id]:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

/**
 * PATCH /api/magasinier/bons-sortie/[id]
 * Mettre à jour le statut d'un bon de sortie
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const { id } = await params;
    const bonId = Number(id);
    if (isNaN(bonId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { statut, notes } = body;

    const validStatuts: StatutBonSortie[] = ["BROUILLON", "VALIDE", "ANNULE"];
    if (!statut || !validStatuts.includes(statut)) {
      return NextResponse.json({ error: "Statut invalide (BROUILLON|VALIDE|ANNULE)" }, { status: 400 });
    }
    // L'annulation d'un bon = suppression logique (RBAC granulaire).
    if (statut === "ANNULE") {
      const denied = await requirePermission(session, "stock", "SUPPRESSION_LOGIQUE");
      if (denied) return denied;
    }

    const bon = await prisma.bonSortie.findUnique({
      where: { id: bonId },
      include: {
        lignes:      true,
        pointDeVente:{ select: { nom: true } },
      },
    });
    if (!bon) return NextResponse.json({ error: "Bon introuvable" }, { status: 404 });

    // Cas spécial : LIVRAISON_CLIENT BROUILLON → VALIDE (confirmer expédition + décrémenter stock)
    if (statut === "VALIDE" && bon.statut === "BROUILLON" && bon.typeSortie === "LIVRAISON_CLIENT") {
      // Vérifier les stocks avant transaction
      for (const l of bon.lignes) {
        const stock = await prisma.stockSite.findUnique({
          where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: bon.pointDeVenteId } },
          include: { produit: { select: { nom: true } } },
        });
        if (!stock || stock.quantite < l.quantite) {
          return NextResponse.json(
            { error: `Stock insuffisant pour "${stock?.produit.nom ?? l.produitId}". Dispo : ${stock?.quantite ?? 0}, demandé : ${l.quantite}` },
            { status: 400 }
          );
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        for (const l of bon.lignes) {
          await tx.stockSite.update({
            where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: bon.pointDeVenteId } },
            data: { quantite: { decrement: l.quantite } },
          });
          await tx.mouvementStock.create({
            data: {
              produitId:      l.produitId,
              pointDeVenteId: bon.pointDeVenteId,
              type:           "SORTIE",
              typeSortie:     "LIVRAISON_CLIENT",
              quantite:       l.quantite,
              motif:          `Livraison client confirmée — ${bon.reference}`,
              reference:      `${bon.reference}-P${l.produitId}`,
              operateurId:    parseInt(session.user.id),
              bonSortieId:    bon.id,
            },
          });
        }

        const result = await tx.bonSortie.update({
          where: { id: bonId },
          data: {
            statut:      "VALIDE",
            valideParId: parseInt(session.user.id),
            notes:       notes ?? bon.notes,
          },
          include: {
            lignes:  { include: { produit: { select: { id: true, nom: true } } } },
            creePar: { select: { nom: true, prenom: true } },
          },
        });

        await auditLog(tx, parseInt(session.user.id), "BON_SORTIE_VALIDE", "BonSortie", bon.id);
        await comptabiliserBonSortie(tx, bon.id, parseInt(session.user.id));

        await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "RESPONSABLE_POINT_DE_VENTE", "COMPTABLE"], {
          titre:    `Livraison client expédiée (${bon.reference})`,
          message:  `${session.user.prenom} ${session.user.nom} a confirmé l'expédition de la livraison client "${bon.reference}" depuis "${bon.pointDeVente.nom}". ${bon.lignes.length} produit(s) déduit(s) du stock.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl:`/dashboard/magasinier/bons-sortie/${bon.id}`,
        });

        return result;
      });

      return NextResponse.json({ data: updated });
    }

    // Cas PERTE/CASSE/VOL/DON/CONSOMMATION_INTERNE/RETOUR_FOURNISSEUR BROUILLON
    // → VALIDE : décrémenter le stock disponible (4.1). PERTE/CASSE vont en plus
    // vers l'endommagé (4.4) — les autres types quittent le stock définitivement
    // sans y être "abîmés". Avant cet élargissement, seuls PERTE/CASSE
    // décrémentaient réellement le stock : un bon DON/VOL/CONSOMMATION_INTERNE/
    // RETOUR_FOURNISSEUR validé ne faisait rien de réel (CDC §56).
    const TYPES_SORTIE_STOCK_REEL: TypeSortieStock[] = ["PERTE", "CASSE", "VOL", "DON", "CONSOMMATION_INTERNE", "RETOUR_FOURNISSEUR"];
    if (statut === "VALIDE" && bon.statut === "BROUILLON" && TYPES_SORTIE_STOCK_REEL.includes(bon.typeSortie)) {
      const versEndommage = bon.typeSortie === "PERTE" || bon.typeSortie === "CASSE";
      // Vérifier les stocks avant transaction
      for (const l of bon.lignes) {
        const stock = await prisma.stockSite.findUnique({
          where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: bon.pointDeVenteId } },
          include: { produit: { select: { nom: true } } },
        });
        if (!stock || stock.quantite < l.quantite) {
          return NextResponse.json(
            { error: `Stock insuffisant pour "${stock?.produit.nom ?? l.produitId}". Dispo : ${stock?.quantite ?? 0}, demandé : ${l.quantite}` },
            { status: 400 }
          );
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        for (const l of bon.lignes) {
          // Décrémenter le disponible (4.1) — PERTE/CASSE en plus vers l'endommagé (4.4)
          await tx.stockSite.update({
            where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: bon.pointDeVenteId } },
            data: versEndommage
              ? { quantite: { decrement: l.quantite }, quantiteEndommagee: { increment: l.quantite } }
              : { quantite: { decrement: l.quantite } },
          });
          await tx.mouvementStock.create({
            data: {
              produitId:      l.produitId,
              pointDeVenteId: bon.pointDeVenteId,
              type:           "SORTIE",
              typeSortie:     bon.typeSortie,
              quantite:       l.quantite,
              motif:          `${bon.typeSortie} constatée — ${bon.reference}`,
              reference:      `${bon.reference}-P${l.produitId}`,
              operateurId:    parseInt(session.user.id),
              bonSortieId:    bon.id,
            },
          });
        }

        const result = await tx.bonSortie.update({
          where: { id: bonId },
          data: { statut: "VALIDE", valideParId: parseInt(session.user.id), notes: notes ?? bon.notes },
          include: { lignes: { include: { produit: { select: { id: true, nom: true } } } }, creePar: { select: { nom: true, prenom: true } } },
        });

        await auditLog(tx, parseInt(session.user.id), "BON_SORTIE_VALIDE", "BonSortie", bon.id);
        await comptabiliserBonSortie(tx, bon.id, parseInt(session.user.id));

        await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "RESPONSABLE_POINT_DE_VENTE"], {
          titre:    `${bon.typeSortie} enregistrée (${bon.reference})`,
          message:  `${session.user.prenom} ${session.user.nom} a validé un bon de ${bon.typeSortie.toLowerCase()} (${bon.reference}) sur "${bon.pointDeVente.nom}". ${bon.lignes.length} produit(s) ${versEndommage ? "mis en stock endommagé" : "sortis du stock"}.`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl:`/dashboard/magasinier/bons-sortie/${bon.id}`,
        });

        return result;
      });

      return NextResponse.json({ data: updated });
    }

    // Mise à jour standard
    const updated = await prisma.bonSortie.update({
      where: { id: bonId },
      data: {
        statut,
        notes:       notes ?? bon.notes,
        valideParId: statut === "VALIDE" ? parseInt(session.user.id) : bon.valideParId,
      },
      include: {
        lignes:  { include: { produit: { select: { id: true, nom: true } } } },
        creePar: { select: { nom: true, prenom: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /magasinier/bons-sortie/[id]:", error);
    return NextResponse.json({ error: "Erreur lors de la mise a jour" }, { status: 500 });
  }
}
