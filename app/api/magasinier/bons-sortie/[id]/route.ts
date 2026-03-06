import { NextResponse } from "next/server";
import { PrioriteNotification, StatutBonSortie } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { auditLog, notifyRoles } from "@/lib/notifications";

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
