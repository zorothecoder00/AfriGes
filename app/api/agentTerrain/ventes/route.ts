import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/agentTerrain/ventes
 * Ventes directes réalisées par l'agent terrain connecté.
 * Query: statut, dateDebut, dateFin, search, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);

    // Trouver le PDV de l'agent via affectation active
    const affectation = await prisma.gestionnaireAffectation.findFirst({
      where: { userId, actif: true },
      include: { pointDeVente: { select: { id: true, nom: true, code: true } } },
    });

    const { searchParams } = new URL(req.url);
    const page      = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit     = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const skip      = (page - 1) * limit;
    const search    = searchParams.get("search")    || "";
    const statut    = searchParams.get("statut")    || "";
    const dateDebut = searchParams.get("dateDebut");
    const dateFin   = searchParams.get("dateFin");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { vendeurId: userId };
    if (statut) where.statut = statut;
    if (dateDebut || dateFin) {
      where.createdAt = {};
      if (dateDebut) where.createdAt.gte = new Date(dateDebut);
      if (dateFin)   where.createdAt.lte = new Date(dateFin + "T23:59:59.999Z");
    }
    if (search) where.OR = [
      { reference: { contains: search, mode: "insensitive" } },
      { clientNom: { contains: search, mode: "insensitive" } },
    ];

    const [ventes, total] = await Promise.all([
      prisma.venteDirecte.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          pointDeVente: { select: { id: true, nom: true } },
          client:       { select: { id: true, nom: true, prenom: true, telephone: true } },
          lignes: {
            include: { produit: { select: { id: true, nom: true, unite: true } } },
          },
        },
      }),
      prisma.venteDirecte.count({ where }),
    ]);

    const montantTotal = ventes
      .filter(v => v.statut === "CONFIRMEE")
      .reduce((acc, v) => acc + Number(v.montantTotal), 0);

    // Produits disponibles (stock du PDV de l'agent)
    const produitsDispo = affectation
      ? await prisma.stockSite.findMany({
          where: { pointDeVenteId: affectation.pointDeVente.id, quantite: { gt: 0 } },
          include: { produit: { select: { id: true, nom: true, reference: true, unite: true, prixUnitaire: true } } },
        })
      : [];

    // Clients disponibles
    const clients = await prisma.client.findMany({
      where: { etat: "ACTIF", ...(affectation && { pointDeVenteId: affectation.pointDeVente.id }) },
      select: { id: true, nom: true, prenom: true, telephone: true },
      orderBy: { nom: "asc" },
    });

    return NextResponse.json({
      data: ventes,
      affectation: affectation?.pointDeVente ?? null,
      produitsDispo,
      clients,
      stats: { total, montantTotal },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /agentTerrain/ventes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/agentTerrain/ventes
 * Enregistrer une vente directe terrain (sans caisse).
 * Body: { modePaiement, montantPaye, clientId?, clientNom?, clientTelephone?, notes?,
 *         lignes: [{produitId, quantite, prixUnitaire?}] }
 */
export async function POST(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);

    // PDV de l'agent
    const affectation = await prisma.gestionnaireAffectation.findFirst({
      where: { userId, actif: true },
      include: { pointDeVente: { select: { id: true, nom: true } } },
    });
    if (!affectation) {
      return NextResponse.json({ error: "Aucun point de vente associé à cet agent" }, { status: 400 });
    }

    const pdvId = affectation.pointDeVente.id;
    const body  = await req.json();
    const { modePaiement, montantPaye, clientId, clientNom, clientTelephone, notes, lignes } = body;

    if (!modePaiement || montantPaye === undefined || !lignes?.length) {
      return NextResponse.json({ error: "modePaiement, montantPaye et lignes sont obligatoires" }, { status: 400 });
    }

    // Vérifier stocks
    let montantTotal = 0;
    for (const l of lignes as Array<{ produitId: number; quantite: number; prixUnitaire?: number }>) {
      const stock = await prisma.stockSite.findUnique({
        where: { produitId_pointDeVenteId: { produitId: Number(l.produitId), pointDeVenteId: pdvId } },
        include: { produit: { select: { nom: true, prixUnitaire: true } } },
      });
      if (!stock || stock.quantite < Number(l.quantite)) {
        return NextResponse.json(
          { error: `Stock insuffisant pour "${stock?.produit.nom ?? l.produitId}". Dispo : ${stock?.quantite ?? 0}` },
          { status: 400 }
        );
      }
      montantTotal += Number(l.quantite) * Number(l.prixUnitaire ?? stock.produit.prixUnitaire);
    }

    const vente = await prisma.$transaction(async (tx) => {
      const ref = `VD-AT-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
      const monnaieRendue = Math.max(0, Number(montantPaye) - montantTotal);

      const v = await tx.venteDirecte.create({
        data: {
          reference:       ref,
          statut:          "CONFIRMEE",
          pointDeVenteId:  pdvId,
          vendeurId:       userId,
          modePaiement,
          montantTotal,
          montantPaye:     Number(montantPaye),
          monnaieRendue,
          notes:           notes || null,
          clientId:        clientId        ? Number(clientId) : null,
          clientNom:       clientNom       || null,
          clientTelephone: clientTelephone || null,
          lignes: {
            create: await Promise.all(
              (lignes as Array<{ produitId: number; quantite: number; prixUnitaire?: number }>).map(async l => {
                const produit = await tx.produit.findUnique({ where: { id: Number(l.produitId) } });
                const prix = Number(l.prixUnitaire ?? produit?.prixUnitaire ?? 0);
                return { produitId: Number(l.produitId), quantite: Number(l.quantite), prixUnitaire: prix, montant: Number(l.quantite) * prix };
              })
            ),
          },
        },
        include: { lignes: true },
      });

      // Décrémenter StockSite + MouvementStock
      for (const ligne of v.lignes) {
        await tx.stockSite.update({
          where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: pdvId } },
          data: { quantite: { decrement: ligne.quantite } },
        });
        await tx.mouvementStock.create({
          data: {
            produitId:     ligne.produitId,
            pointDeVenteId:pdvId,
            type:          "SORTIE",
            typeSortie:    "VENTE_DIRECTE",
            quantite:      ligne.quantite,
            motif:         `Vente terrain ${ref}`,
            reference:     `${ref}-P${ligne.produitId}`,
            operateurId:   userId,
            venteDirecteId:v.id,
          },
        });
      }

      await auditLog(tx, userId, "VENTE_DIRECTE_CREEE", "VenteDirecte", v.id);

      await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE", "CAISSIER"], {
        titre:    `Vente terrain : ${ref}`,
        message:  `${session.user.prenom} ${session.user.nom} a réalisé une vente de ${montantTotal.toLocaleString("fr-FR")} FCFA sur "${affectation.pointDeVente.nom}".`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl:`/dashboard/agentTerrain/ventes`,
      });

      return v;
    });

    return NextResponse.json({ data: vente }, { status: 201 });
  } catch (error) {
    console.error("POST /agentTerrain/ventes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
