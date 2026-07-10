import { NextRequest, NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";
import { resolveViewAs } from "@/lib/viewAs";
import { tariferLigne } from "@/lib/venteTarification";
   
/**
 * GET /api/rpv/ventes
 * Ventes directes enregistrées par le RPV (ou sur son PDV).
 * Query: statut, dateDebut, dateFin, search, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const viewAs  = isAdmin ? resolveViewAs(req) : null;
    const effectiveUserId = viewAs?.userId ?? parseInt(session.user.id);

    // Trouver le PDV du RPV (ou du gestionnaire ciblé en viewAs)
    const pdv = await prisma.pointDeVente.findUnique({ where: { rpvId: effectiveUserId } });
    if (!pdv) return NextResponse.json({ error: "Aucun PDV associé à ce RPV" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const page      = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit     = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const skip      = (page - 1) * limit;
    const search        = searchParams.get("search")        || "";
    const statut        = searchParams.get("statut")        || "";
    const dateDebut     = searchParams.get("dateDebut");
    const dateFin       = searchParams.get("dateFin");
    const aujourdHui    = searchParams.get("aujourdHui") === "true";
    const modePaiement  = searchParams.get("modePaiement")  || "";
    const vendeurId     = searchParams.get("vendeurId")     || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { pointDeVenteId: pdv.id };
    if (statut)       where.statut       = statut;
    if (modePaiement) where.modePaiement = modePaiement;
    if (vendeurId)    where.vendeurId    = parseInt(vendeurId);
    if (aujourdHui) {
      const now = new Date();
      where.createdAt = {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
        lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      };
    } else if (dateDebut || dateFin) {
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

    // Produits avec stock réellement disponible (quantite - quantiteReservee > 0)
    const allStocks = await prisma.stockSite.findMany({
      where: { pointDeVenteId: pdv.id, quantite: { gt: 0 } },
      include: { produit: { select: { id: true, nom: true, reference: true, unite: true, prixUnitaire: true } } },
    });
    const produitsDispo = allStocks.filter(s => (s.quantite - s.quantiteReservee) > 0);

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

    // Segment du client enregistré (profil tarifaire / promos ciblées).
    const clientSegment = clientId
      ? (await prisma.client.findUnique({ where: { id: Number(clientId) }, select: { segment: true } }))?.segment ?? null
      : null;

    // Vérifier stocks et TARIFER côté serveur (Catalogue §4/§9 : prix résolu +
    // promotion — le prix envoyé par le client n'est plus autoritaire, cf. §15).
    let montantTotal = 0;
    const lignesTarifees: Array<{ produitId: number; quantite: number; prixUnitaire: number; montant: number }> = [];
    for (const l of lignes as Array<{ produitId: number; quantite: number }>) {
      const stock = await prisma.stockSite.findUnique({
        where: { produitId_pointDeVenteId: { produitId: Number(l.produitId), pointDeVenteId: pdv.id } },
        include: { produit: { select: { id: true, nom: true, prixUnitaire: true, categorieId: true, familleId: true, marqueId: true } } },
      });
      const qteDispo = (stock?.quantite ?? 0) - (stock?.quantiteReservee ?? 0);
      if (!stock || qteDispo < Number(l.quantite)) {
        return NextResponse.json(
          { error: `Stock insuffisant pour "${stock?.produit.nom ?? l.produitId}". Disponible : ${qteDispo}, demandé : ${l.quantite}` },
          { status: 400 }
        );
      }
      const tarif = await tariferLigne(stock.produit, Number(l.quantite), {
        pointDeVenteId: pdv.id,
        clientId: clientId ? Number(clientId) : null,
        segment: clientSegment,
        aCredit: false,
      });
      montantTotal += tarif.montant;
      lignesTarifees.push({
        produitId: Number(l.produitId),
        quantite: Number(l.quantite),
        prixUnitaire: tarif.prixUnitaire,
        montant: tarif.montant,
      });
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
          lignes: { create: lignesTarifees },
        },
        include: { lignes: true },
      });

      // Décrémenter StockSite + MouvementStock pour chaque ligne
      for (const ligne of v.lignes) {
        if (!ligne.produitId) continue;
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
