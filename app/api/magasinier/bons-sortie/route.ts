import { NextResponse } from "next/server";
import { PrioriteNotification, TypeSortieStock } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/magasinier/bons-sortie
 * Liste des bons de sortie du PDV du magasinier connecté.
 * Query: statut, typeSortie, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    // Résoudre le PDV du magasinier
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: parseInt(session.user.id), actif: true },
      select: { pointDeVenteId: true },
    });
    const pdvId = aff?.pointDeVenteId;
    if (!pdvId) {
      return NextResponse.json({ error: "Aucun point de vente associé à ce magasinier" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const page       = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit      = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip       = (page - 1) * limit;
    const statut     = searchParams.get("statut")    || "";
    const typeSortie = searchParams.get("typeSortie") || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { pointDeVenteId: pdvId };
    if (statut)     where.statut     = statut;
    if (typeSortie) where.typeSortie = typeSortie;

    const [bons, total] = await Promise.all([
      prisma.bonSortie.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          pointDeVente: { select: { id: true, nom: true, code: true } },
          creePar:      { select: { id: true, nom: true, prenom: true } },
          validePar:    { select: { id: true, nom: true, prenom: true } },
          lignes: {
            include: { produit: { select: { id: true, nom: true, reference: true, prixUnitaire: true } } },
          },
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
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/magasinier/bons-sortie
 * Créer un bon de sortie exceptionnel et déduire le stock du PDV concerné.
 * Body: { pointDeVenteId, typeSortie, motif, notes?, lignes: [{produitId, quantite}] }
 * typeSortie valides : PERTE | CASSE | DON | CONSOMMATION_INTERNE | LIVRAISON_CLIENT
 */
export async function POST(req: Request) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    // Résoudre le PDV du magasinier
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: parseInt(session.user.id), actif: true },
      select: { pointDeVenteId: true },
    });
    const pdvId = aff?.pointDeVenteId;
    if (!pdvId) {
      return NextResponse.json({ error: "Aucun point de vente associé à ce magasinier" }, { status: 400 });
    }

    const body = await req.json();
    const { typeSortie, motif, notes, lignes } = body;
    // Forcer le PDV du magasinier — ignorer tout pointDeVenteId du body
    const pointDeVenteId = pdvId;

    if (!typeSortie || !motif || !lignes?.length) {
      return NextResponse.json(
        { error: "typeSortie, motif et lignes sont obligatoires" },
        { status: 400 }
      );
    }

    const typesValides: TypeSortieStock[] = ["PERTE", "CASSE", "DON", "CONSOMMATION_INTERNE", "LIVRAISON_CLIENT"];
    if (!typesValides.includes(typeSortie as TypeSortieStock)) {
      return NextResponse.json(
        { error: `typeSortie invalide. Valeurs acceptées : ${typesValides.join(", ")}` },
        { status: 400 }
      );
    }

    // Vérifier stocks avant transaction
    for (const l of lignes as Array<{ produitId: number; quantite: number }>) {
      const stock = await prisma.stockSite.findUnique({
        where: { produitId_pointDeVenteId: { produitId: Number(l.produitId), pointDeVenteId: Number(pointDeVenteId) } },
        include: { produit: { select: { nom: true } } },
      });
      if (!stock || stock.quantite < Number(l.quantite)) {
        return NextResponse.json(
          { error: `Stock insuffisant pour "${stock?.produit.nom ?? l.produitId}". Dispo : ${stock?.quantite ?? 0}, demandé : ${l.quantite}` },
          { status: 400 }
        );
      }
    }

    const bonSortie = await prisma.$transaction(async (tx) => {
      const ref = `BS-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

      // Récupérer prix unitaires pour les lignes
      const produitsData = await Promise.all(
        (lignes as Array<{ produitId: number; quantite: number }>).map(l =>
          tx.produit.findUnique({ where: { id: Number(l.produitId) }, select: { id: true, nom: true, prixUnitaire: true } })
        )
      );

      const bon = await tx.bonSortie.create({
        data: {
          reference:     ref,
          typeSortie:    typeSortie as TypeSortieStock,
          statut:        "BROUILLON",
          pointDeVenteId:Number(pointDeVenteId),
          motif,
          notes:         notes || null,
          creeParId:     parseInt(session.user.id),
          lignes: {
            create: (lignes as Array<{ produitId: number; quantite: number }>).map((l, i) => ({
              produitId: Number(l.produitId),
              quantite:  Number(l.quantite),
              prixUnit:  produitsData[i]?.prixUnitaire ?? null,
            })),
          },
        },
        include: {
          lignes: { include: { produit: { select: { id: true, nom: true } } } },
          pointDeVente: { select: { nom: true } },
        },
      });

      // Décrémenter StockSite + créer MouvementStock
      for (const ligne of bon.lignes) {
        await tx.stockSite.update({
          where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: Number(pointDeVenteId) } },
          data: { quantite: { decrement: ligne.quantite } },
        });

        await tx.mouvementStock.create({
          data: {
            produitId:      ligne.produitId,
            pointDeVenteId: Number(pointDeVenteId),
            type:           "SORTIE",
            typeSortie:     typeSortie as TypeSortieStock,
            quantite:       ligne.quantite,
            motif:          `Bon de sortie ${ref} — ${motif}`,
            reference:      `${ref}-P${ligne.produitId}`,
            operateurId:    parseInt(session.user.id),
            bonSortieId:    bon.id,
          },
        });
      }

      // Marquer comme VALIDE directement (le magasinier valide à la création)
      await tx.bonSortie.update({ where: { id: bon.id }, data: { statut: "VALIDE", valideParId: parseInt(session.user.id) } });

      await auditLog(tx, parseInt(session.user.id), "BON_SORTIE_CREE", "BonSortie", bon.id);

      const isPrioritaire = ["PERTE", "CASSE"].includes(typeSortie);
      await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "RESPONSABLE_POINT_DE_VENTE", "COMPTABLE"], {
        titre:    `Bon de sortie ${typeSortie} (${ref})`,
        message:  `${session.user.prenom} ${session.user.nom} a émis un bon de sortie "${typeSortie}" pour "${bon.pointDeVente.nom}". ${bon.lignes.length} ligne(s). Motif : ${motif}.`,
        priorite: isPrioritaire ? PrioriteNotification.HAUTE : PrioriteNotification.NORMAL,
        actionUrl:`/dashboard/magasinier/bons-sortie/${bon.id}`,
      });

      return bon;
    });

    return NextResponse.json({ data: bonSortie }, { status: 201 });
  } catch (error) {
    console.error("POST /magasinier/bons-sortie:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
