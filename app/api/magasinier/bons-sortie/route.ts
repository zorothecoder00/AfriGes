import { NextResponse } from "next/server";
import { TypeBonSortie, TypeMouvement, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { randomUUID } from "crypto";
import { notifyRoles } from "@/lib/notifications";

/**
 * GET /api/magasinier/bons-sortie
 * Liste des bons de sortie
 */
export async function GET(req: Request) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page") || 1));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip   = (page - 1) * limit;
    const statut = searchParams.get("statut");
    const type   = searchParams.get("type");

    const where = {
      ...(statut && { statut: statut as "EN_COURS" | "EXPEDIE" | "RECU" | "ANNULE" }),
      ...(type   && { type:   type   as TypeBonSortie }),
    };

    const [bons, total] = await Promise.all([
      prisma.bonSortie.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          lignes: {
            include: { produit: { select: { id: true, nom: true, prixUnitaire: true } } },
          },
          magasinier: { select: { id: true, nom: true, prenom: true } },
        },
      }),
      prisma.bonSortie.count({ where }),
    ]);

    return NextResponse.json({
      data: bons,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /magasinier/bons-sortie:", error);
    return NextResponse.json({ error: "Erreur lors du chargement" }, { status: 500 });
  }
}

/**
 * POST /api/magasinier/bons-sortie
 * Créer un nouveau bon de sortie et déduire le stock
 */
export async function POST(req: Request) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const body = await req.json();
    const { type, destinataire, motif, notes, lignes } = body;

    if (!type || !motif || !lignes || !Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json(
        { error: "Champs obligatoires : type, motif, lignes (tableau non vide)" },
        { status: 400 }
      );
    }

    const validTypes: TypeBonSortie[] = ["PDV", "PERTE", "CASSE", "DON", "COMMANDE_INTERNE"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Type invalide" }, { status: 400 });
    }

    // Vérification des stocks avant transaction
    for (const ligne of lignes) {
      const produit = await prisma.produit.findUnique({ where: { id: Number(ligne.produitId) } });
      if (!produit) {
        return NextResponse.json({ error: `Produit ${ligne.produitId} introuvable` }, { status: 404 });
      }
      if (produit.stock < Number(ligne.quantite)) {
        return NextResponse.json(
          { error: `Stock insuffisant pour "${produit.nom}" (dispo: ${produit.stock}, demandé: ${ligne.quantite})` },
          { status: 400 }
        );
      }
    }

    const bonSortie = await prisma.$transaction(async (tx) => {
      const reference = `BS-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

      // Récupérer les prix unitaires
      const produitsData = await Promise.all(
        lignes.map((l: { produitId: number; quantite: number }) =>
          tx.produit.findUnique({ where: { id: Number(l.produitId) } })
        )
      );

      const bon = await tx.bonSortie.create({
        data: {
          reference,
          type:         type as TypeBonSortie,
          destinataire: destinataire ?? null,
          motif,
          notes:        notes ?? null,
          creePar:      parseInt(session.user.id),
          lignes: {
            create: lignes.map((l: { produitId: number; quantite: number }, i: number) => ({
              produitId: Number(l.produitId),
              quantite:  Number(l.quantite),
              prixUnit:  produitsData[i]?.prixUnitaire ?? 0,
            })),
          },
        },
        include: {
          lignes: { include: { produit: { select: { id: true, nom: true } } } },
        },
      });

      // Déduire le stock et enregistrer les mouvements
      for (const ligne of bon.lignes) {
        await tx.produit.update({
          where: { id: ligne.produitId },
          data: { stock: { decrement: ligne.quantite } },
        });

        await tx.mouvementStock.create({
          data: {
            produitId:     ligne.produitId,
            type:          TypeMouvement.SORTIE,
            quantite:      ligne.quantite,
            motif:         `Bon de sortie ${reference} — ${motif} (${type})`,
            reference:     `${reference}-P${ligne.produitId}`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId:   parseInt(session.user.id),
          action:   "BON_SORTIE_CREE",
          entite:   "BonSortie",
          entiteId: bon.id,
        },
      });

      const typeLabel: Record<string, string> = {
        PDV:              "Point de Vente",
        PERTE:            "Perte",
        CASSE:            "Casse",
        DON:              "Don",
        COMMANDE_INTERNE: "Commande interne",
      };

      await notifyRoles(
        tx,
        ["RESPONSABLE_POINT_DE_VENTE", "COMPTABLE"],
        {
          titre:    `Bon de sortie créé (${typeLabel[type]})`,
          message:  `${session.user.prenom} ${session.user.nom} a émis le bon de sortie ${reference}. Motif : ${motif}. ${lignes.length} ligne(s).`,
          priorite: ["PERTE", "CASSE"].includes(type) ? PrioriteNotification.HAUTE : PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/admin/stock`,
        }
      );

      return bon;
    });

    return NextResponse.json({ data: bonSortie }, { status: 201 });
  } catch (error) {
    console.error("POST /magasinier/bons-sortie:", error);
    return NextResponse.json({ error: "Erreur lors de la creation" }, { status: 500 });
  }
}
