import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/logistique/affectations
 * Historique des affectations de stock vers les PDV (type TRANSFERT_ENTRANT sur StockSite).
 * Retourne aussi la liste des PDV et produits disponibles pour le formulaire.
 */
export async function GET(req: Request) {
  try {
    const session = await getLogistiqueSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page    = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit   = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const skip    = (page - 1) * limit;
    const search  = searchParams.get("search")  || "";
    const pdvId   = searchParams.get("pdvId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      type:      "ENTREE",
      typeEntree:"AJUSTEMENT_POSITIF",
      motif:     { startsWith: "Affectation logistique" },
    };
    if (pdvId)  where.pointDeVenteId = Number(pdvId);
    if (search) where.OR = [
      { motif:     { contains: search, mode: "insensitive" } },
      { reference: { contains: search, mode: "insensitive" } },
      { produit:   { nom: { contains: search, mode: "insensitive" } } },
    ];

    const [mouvements, total, pdvs, produits] = await Promise.all([
      prisma.mouvementStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateMouvement: "desc" },
        include: {
          produit:      { select: { id: true, nom: true, reference: true, unite: true } },
          pointDeVente: { select: { id: true, nom: true, code: true } },
          operateur:    { select: { id: true, nom: true, prenom: true } },
        },
      }),
      prisma.mouvementStock.count({ where }),
      prisma.pointDeVente.findMany({
        where: { actif: true },
        select: { id: true, nom: true, code: true, type: true },
        orderBy: { nom: "asc" },
      }),
      prisma.produit.findMany({
        where: { actif: true },
        select: { id: true, nom: true, reference: true, unite: true, stocks: { select: { pointDeVenteId: true, quantite: true } } },
        orderBy: { nom: "asc" },
      }),
    ]);

    return NextResponse.json({
      data: mouvements,
      pdvs,
      produits,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /logistique/affectations:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/logistique/affectations
 * Affecter du stock depuis le dépôt central vers un PDV.
 * Body: { produitId, pointDeVenteId, depotSourceId, quantite, notes }
 * - Décrémente StockSite du dépôt source
 * - Incrémente StockSite du PDV cible
 * - Enregistre 2 MouvementStock (SORTIE dépôt + ENTREE PDV)
 */
export async function POST(req: Request) {
  try {
    const session = await getLogistiqueSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { produitId, pointDeVenteId, depotSourceId, quantite, notes } = body;

    if (!produitId || !pointDeVenteId || !depotSourceId || !quantite) {
      return NextResponse.json(
        { error: "produitId, pointDeVenteId, depotSourceId, quantite sont obligatoires" },
        { status: 400 }
      );
    }

    const qty = Number(quantite);
    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json({ error: "La quantité doit être un entier positif" }, { status: 400 });
    }

    // Vérifier stock disponible au dépôt source
    const stockSource = await prisma.stockSite.findUnique({
      where: {
        produitId_pointDeVenteId: {
          produitId:      Number(produitId),
          pointDeVenteId: Number(depotSourceId),
        },
      },
      include: { produit: true, pointDeVente: { select: { nom: true } } },
    });

    if (!stockSource || stockSource.quantite < qty) {
      return NextResponse.json(
        { error: `Stock insuffisant au dépôt source. Disponible : ${stockSource?.quantite ?? 0}, demandé : ${qty}` },
        { status: 400 }
      );
    }

    const pdvCible = await prisma.pointDeVente.findUnique({
      where: { id: Number(pointDeVenteId) },
      select: { nom: true, code: true },
    });
    if (!pdvCible) return NextResponse.json({ error: "PDV cible introuvable" }, { status: 404 });

    const operateur = `${session.user.prenom} ${session.user.nom}`;
    const ref = `AFF-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Décrémenter stock dépôt source
      await tx.stockSite.update({
        where: { produitId_pointDeVenteId: { produitId: Number(produitId), pointDeVenteId: Number(depotSourceId) } },
        data: { quantite: { decrement: qty } },
      });

      // 2. Incrémenter (ou créer) stock PDV cible
      await tx.stockSite.upsert({
        where: { produitId_pointDeVenteId: { produitId: Number(produitId), pointDeVenteId: Number(pointDeVenteId) } },
        update: { quantite: { increment: qty } },
        create: { produitId: Number(produitId), pointDeVenteId: Number(pointDeVenteId), quantite: qty },
      });

      // 3. MouvementStock SORTIE sur dépôt source
      await tx.mouvementStock.create({
        data: {
          produitId:      Number(produitId),
          pointDeVenteId: Number(depotSourceId),
          type:           "SORTIE",
          typeSortie:     "TRANSFERT_SORTANT",
          quantite:       qty,
          motif:          `Affectation logistique → ${pdvCible.nom}${notes ? ` — ${notes}` : ""}`,
          reference:      `${ref}-OUT`,
          operateurId:    parseInt(session.user.id),
        },
      });

      // 4. MouvementStock ENTREE sur PDV cible
      const mvtEntree = await tx.mouvementStock.create({
        data: {
          produitId:      Number(produitId),
          pointDeVenteId: Number(pointDeVenteId),
          type:           "ENTREE",
          typeEntree:     "TRANSFERT_ENTRANT",
          quantite:       qty,
          motif:          `Affectation logistique depuis ${stockSource.pointDeVente.nom}${notes ? ` — ${notes}` : ""} par ${operateur}`,
          reference:      `${ref}-IN`,
          operateurId:    parseInt(session.user.id),
        },
      });

      await auditLog(tx, parseInt(session.user.id), "AFFECTATION_STOCK", "MouvementStock", mvtEntree.id);

      await notifyRoles(tx, ["MAGAZINIER", "RESPONSABLE_POINT_DE_VENTE"], {
        titre:    `Affectation stock : ${stockSource.produit.nom}`,
        message:  `${operateur} a affecté ${qty} unité(s) de "${stockSource.produit.nom}" au PDV "${pdvCible.nom}". Dépôt source : ${stockSource.pointDeVente.nom}.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl:`/dashboard/logistique/stock`,
      });

      return mvtEntree;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /logistique/affectations:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
