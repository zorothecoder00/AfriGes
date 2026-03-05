import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/rpv/ventes
 * Ventes directes enregistrées par le RPV (ou sur son PDV).
 * Query: statut, dateDebut, dateFin, search, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);

    // Trouver le PDV du RPV
    const pdv = await prisma.pointDeVente.findUnique({ where: { rpvId: userId } });
    if (!pdv) return NextResponse.json({ error: "Aucun PDV associé à ce RPV" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const page      = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit     = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const skip      = (page - 1) * limit;
    const search    = searchParams.get("search")    || "";
    const statut    = searchParams.get("statut")    || "";
    const dateDebut = searchParams.get("dateDebut");
    const dateFin   = searchParams.get("dateFin");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { pointDeVenteId: pdv.id };
    if (statut) where.statut = statut;
    if (dateDebut || dateFin) {
      where.createdAt = {};
      if (dateDebut) where.createdAt.gte = new Date(dateDebut);
      if (dateFin)   where.createdAt.lte = new Date(dateFin + "T23:59:59.999Z");
    }
    if (search) where.OR = [
      { reference:      { contains: search, mode: "insensitive" } },
      { clientNom:      { contains: search, mode: "insensitive" } },
      { client:         { nom:    { contains: search, mode: "insensitive" } } },
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

    // Stats
    const statsAll = await prisma.venteDirecte.findMany({
      where: { ...where, statut: "CONFIRMEE" },
      select: { montantTotal: true },
    });
    const montantTotal = statsAll.reduce((acc, v) => acc + Number(v.montantTotal), 0);

    // Produits disponibles au PDV pour le formulaire
    const produitsDispo = await prisma.stockSite.findMany({
      where: { pointDeVenteId: pdv.id, quantite: { gt: 0 } },
      include: { produit: { select: { id: true, nom: true, reference: true, unite: true, prixUnitaire: true } } },
    });

    // Clients du PDV
    const clients = await prisma.client.findMany({
      where: { etat: "ACTIF" },
      select: { id: true, nom: true, prenom: true, telephone: true },
      orderBy: { nom: "asc" },
    });

    return NextResponse.json({
      data: ventes,
      produitsDispo,
      clients,
      stats: { total, montantTotal },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /rpv/ventes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/rpv/ventes
 * Enregistrer une vente directe depuis la petite caisse RPV.
 * Body: { modePaiement, montantPaye, clientId?, clientNom?, clientTelephone?, notes?,
 *         lignes: [{produitId, quantite, prixUnitaire?}] }
 */
export async function POST(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const pdv = await prisma.pointDeVente.findUnique({ where: { rpvId: userId } });
    if (!pdv) return NextResponse.json({ error: "Aucun PDV associé à ce RPV" }, { status: 400 });

    const body = await req.json();
    const { modePaiement, montantPaye, clientId, clientNom, clientTelephone, notes, lignes } = body;

    if (!modePaiement || montantPaye === undefined || !lignes?.length) {
      return NextResponse.json({ error: "modePaiement, montantPaye et lignes sont obligatoires" }, { status: 400 });
    }

    // Vérifier stocks et calculer montant
    let montantTotal = 0;
    for (const l of lignes as Array<{ produitId: number; quantite: number; prixUnitaire?: number }>) {
      const stock = await prisma.stockSite.findUnique({
        where: { produitId_pointDeVenteId: { produitId: Number(l.produitId), pointDeVenteId: pdv.id } },
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

    // Caisse PDV ouverte (optionnel — pas bloquant)
    const caissePDV = await prisma.caissePDV.findFirst({
      where: { rpvId: userId, statut: "OUVERTE" },
    });

    const vente = await prisma.$transaction(async (tx) => {
      const ref = `VD-RPV-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
      const monnaieRendue = Math.max(0, Number(montantPaye) - montantTotal);

      const v = await tx.venteDirecte.create({
        data: {
          reference:      ref,
          statut:         "CONFIRMEE",
          pointDeVenteId: pdv.id,
          vendeurId:      userId,
          modePaiement,
          montantTotal,
          montantPaye:    Number(montantPaye),
          monnaieRendue,
          notes:          notes || null,
          clientId:       clientId   ? Number(clientId) : null,
          clientNom:      clientNom  || null,
          clientTelephone:clientTelephone || null,
          caissePDVId:    caissePDV?.id ?? null,
          lignes: {
            create: await Promise.all(
              (lignes as Array<{ produitId: number; quantite: number; prixUnitaire?: number }>).map(async l => {
                const produit = await tx.produit.findUnique({ where: { id: Number(l.produitId) } });
                const prix = Number(l.prixUnitaire ?? produit?.prixUnitaire ?? 0);
                return {
                  produitId:   Number(l.produitId),
                  quantite:    Number(l.quantite),
                  prixUnitaire:prix,
                  montant:     Number(l.quantite) * prix,
                };
              })
            ),
          },
        },
        include: { lignes: true },
      });

      // Décrémenter StockSite + MouvementStock pour chaque ligne
      for (const ligne of v.lignes) {
        await tx.stockSite.update({
          where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: pdv.id } },
          data: { quantite: { decrement: ligne.quantite } },
        });
        await tx.mouvementStock.create({
          data: {
            produitId:     ligne.produitId,
            pointDeVenteId:pdv.id,
            type:          "SORTIE",
            typeSortie:    "VENTE_DIRECTE",
            quantite:      ligne.quantite,
            motif:         `Vente directe ${ref}`,
            reference:     `${ref}-P${ligne.produitId}`,
            operateurId:   userId,
            venteDirecteId:v.id,
          },
        });
      }

      // Encaisser dans la petite caisse si ouverte
      if (caissePDV) {
        await tx.caissePDV.update({
          where: { id: caissePDV.id },
          data: { fondsCaisse: { increment: Number(montantPaye) } },
        });
        await tx.operationCaissePDV.create({
          data: {
            caissePDVId:  caissePDV.id,
            type:         "ENCAISSEMENT",
            montant:      montantTotal,
            motif:        `Vente directe ${ref}`,
            reference:    `${ref}-CAISSE`,
            operateurNom: `${session.user.prenom} ${session.user.nom}`,
            operateurId:  userId,
          },
        });
      }

      await auditLog(tx, userId, "VENTE_DIRECTE_CREEE", "VenteDirecte", v.id);

      await notifyRoles(tx, ["CAISSIER", "COMPTABLE"], {
        titre:    `Vente directe : ${ref}`,
        message:  `${session.user.prenom} ${session.user.nom} a enregistré une vente de ${montantTotal.toLocaleString("fr-FR")} FCFA sur "${pdv.nom}".`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl:`/dashboard/rpv/ventes`,
      });

      return v;
    });

    return NextResponse.json({ data: vente }, { status: 201 });
  } catch (error) {
    console.error("POST /rpv/ventes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
