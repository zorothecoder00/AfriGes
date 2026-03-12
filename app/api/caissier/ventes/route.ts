import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";
import { randomUUID } from "crypto";  
import { notifyRoles, auditLog } from "@/lib/notifications";

/**  
 * GET /api/caissier/ventes
 * Ventes directes enregistrées sur le PDV du caissier.
 * Query: statut, dateDebut, dateFin, search, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);

    // Trouver le PDV du caissier via session caisse ouverte
    const sessionCaisse = await prisma.sessionCaisse.findFirst({
      where: { caissierId: userId, statut: "OUVERTE" },
      select: { id: true, pointDeVenteId: true, pointDeVente: { select: { id: true, nom: true } } },
    });

    const { searchParams } = new URL(req.url);
    const page      = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit     = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const skip      = (page - 1) * limit;
    const search    = searchParams.get("search")    || "";
    const statut    = searchParams.get("statut")    || "";
    const dateDebut = searchParams.get("dateDebut");
    const dateFin   = searchParams.get("dateFin");
    const aujourdHui= searchParams.get("aujourdHui") === "true";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (sessionCaisse?.pointDeVenteId) where.pointDeVenteId = sessionCaisse.pointDeVenteId;
    if (statut) where.statut = statut;

    if (aujourdHui) {
      const now = new Date();
      where.createdAt = {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
        lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      };
    } else if (dateDebut || dateFin) {
      where.createdAt = {};
      if (dateDebut) where.createdAt.gte = new Date(dateDebut);
      if (dateFin)   where.createdAt.lte = new Date(dateFin + "T23:59:59.999Z");
    }

    if (search) where.OR = [
      { reference: { contains: search, mode: "insensitive" } },
      { clientNom: { contains: search, mode: "insensitive" } },
      { client:    { nom: { contains: search, mode: "insensitive" } } },
    ];

    const [ventes, total] = await Promise.all([
      prisma.venteDirecte.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          vendeur: { select: { id: true, nom: true, prenom: true } },
          client:  { select: { id: true, nom: true, prenom: true, telephone: true } },
          lignes: {
            include: { produit: { select: { id: true, nom: true, unite: true } } },
          },
        },
      }),
      prisma.venteDirecte.count({ where }),
    ]);

    const allMontants = await prisma.venteDirecte.findMany({
      where: { ...where, statut: "CONFIRMEE" },
      select: { montantTotal: true },
    });
    const montantTotal  = allMontants.reduce((acc, v) => acc + Number(v.montantTotal), 0);

    // Produits disponibles au PDV
    const pdvId = sessionCaisse?.pointDeVenteId;
    const produitsDispo = pdvId
      ? await prisma.stockSite.findMany({
          where: { pointDeVenteId: pdvId, quantite: { gt: 0 } },
          include: { produit: { select: { id: true, nom: true, reference: true, unite: true, prixUnitaire: true } } },
        })
      : [];

    return NextResponse.json({
      data: ventes,
      produitsDispo,
      sessionCaisse,
      stats: { total, montantTotal },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /caissier/ventes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/caissier/ventes
 * Enregistrer une vente directe sur la grande caisse.
 * Body: { modePaiement, montantPaye, clientId?, clientNom?, clientTelephone?, notes?,
 *         lignes: [{produitId, quantite, prixUnitaire?}] }
 */
export async function POST(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);

    // Session caisse ouverte obligatoire
    const sessionCaisse = await prisma.sessionCaisse.findFirst({
      where: { caissierId: userId, statut: "OUVERTE" },
      include: { pointDeVente: { select: { id: true, nom: true } } },
    });
    if (!sessionCaisse) {
      return NextResponse.json({ error: "Aucune session caisse ouverte" }, { status: 400 });
    }
    if (!sessionCaisse.pointDeVenteId) {
      return NextResponse.json({ error: "La session caisse n'est pas liée à un PDV" }, { status: 400 });
    }

    const pdvId = sessionCaisse.pointDeVenteId;
    const body = await req.json();
    const { modePaiement, montantPaye, clientId, clientNom, clientTelephone, notes, lignes } = body;

    if (!modePaiement || montantPaye === undefined || !lignes?.length) {
      return NextResponse.json({ error: "modePaiement, montantPaye et lignes sont obligatoires" }, { status: 400 });
    }

    // Vérifier stocks et calculer montant total
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
      const ref = `VD-CAISSE-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
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
          sessionCaisseId: sessionCaisse.id,
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
            produitId:      ligne.produitId,
            pointDeVenteId: pdvId,
            type:           "SORTIE",
            typeSortie:     "VENTE_DIRECTE",
            quantite:       ligne.quantite,
            motif:          `Vente directe ${ref}`,
            reference:      `${ref}-P${ligne.produitId}`,
            operateurId:    userId,
            venteDirecteId: v.id,
          },
        });
      }

      // Encaissement sur la grande caisse
      await tx.operationCaisse.create({
        data: {
          sessionId:    sessionCaisse.id,
          type:         "ENCAISSEMENT",
          montant:      montantTotal,
          motif:        `Vente directe ${ref}`,
          reference:    `${ref}-CAISSE`,
          operateurNom: `${session.user.prenom} ${session.user.nom}`,
          operateurId:  userId,
        },
      });

      await auditLog(tx, userId, "VENTE_DIRECTE_CREEE", "VenteDirecte", v.id);

      await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE", "COMPTABLE"], {
        titre:    `Vente directe caisse : ${ref}`,
        message:  `${session.user.prenom} ${session.user.nom} a enregistré une vente de ${montantTotal.toLocaleString("fr-FR")} FCFA.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl:`/dashboard/caissier/ventes`,
      });

      return v;
    });

    return NextResponse.json({ data: vente }, { status: 201 });
  } catch (error) {
    console.error("POST /caissier/ventes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
