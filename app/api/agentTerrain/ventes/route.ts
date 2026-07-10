import { NextRequest, NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";
import { resolveViewAs } from "@/lib/viewAs";
import {
  getCompteCourantParClient, chargerParametrageCC, preleverCompteCourant, extraireMetaRequete,
} from "@/lib/compteCourant";
import { tariferLigne } from "@/lib/venteTarification";
import { consommerFEFOBestEffort } from "@/lib/lotsFefo";
import { substitutsDisponibles } from "@/lib/substitutsServer";
import { resoudrePrixBatch } from "@/lib/tarificationBatch";

/**
 * GET /api/agentTerrain/ventes
 * Ventes directes COMPTANT réalisées par l'agent terrain connecté.
 * Query: statut, dateDebut, dateFin, search, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const viewAs  = isAdmin ? resolveViewAs(req) : null;
    const effectiveUserId = viewAs?.userId ?? parseInt(session.user.id);

    const affectation = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: effectiveUserId, actif: true },
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
    const where: any = { vendeurId: effectiveUserId };
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

    // Produits disponibles au PDV (quantite - quantiteReservee > 0)
    const allStocks = affectation
      ? await prisma.stockSite.findMany({
          where: { pointDeVenteId: affectation.pointDeVente.id, quantite: { gt: 0 } },
          include: { produit: { select: { id: true, nom: true, reference: true, unite: true, prixUnitaire: true } } },
        })
      : [];
    const produitsDispoBrut = allStocks
      .map(s => ({ ...s, quantite: s.quantite - s.quantiteReservee }))
      .filter(s => s.quantite > 0);
    // Prix DETAIL résolu par agence (§8) pour afficher le bon tarif à la sélection.
    const prixMapV = await resoudrePrixBatch(
      produitsDispoBrut.map(s => s.produit.id), ["DETAIL"],
      { pointDeVenteId: affectation?.pointDeVente.id ?? null },
    );
    const produitsDispo = produitsDispoBrut.map(s => ({
      ...s,
      produit: { ...s.produit, prixDetail: prixMapV.get(s.produit.id)?.DETAIL ?? Number(s.produit.prixUnitaire) },
    }));

    // Clients du PDV
    const clients = affectation
      ? await prisma.client.findMany({
          where: { etat: "ACTIF", pointDeVenteId: affectation.pointDeVente.id },
          select: { id: true, nom: true, prenom: true, telephone: true },
          orderBy: { nom: "asc" },
        })
      : [];

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
 * Enregistrer une vente directe COMPTANT terrain.
 *
 * Body: { montantPaye?, clientId?, clientNom?, clientTelephone?, notes?,
 *         lignes: [{ produitId, quantite }] }
 *
 * - Seuls les produits catalogue (produitId) sont acceptés.
 * - Le stock doit être suffisant (quantite - quantiteReservee ≥ qte demandée).
 * - Le stock est décrémenté immédiatement + MouvementStock créé.
 */
export async function POST(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);

    const affectation = await prisma.gestionnaireAffectation.findFirst({
      where: { userId, actif: true },
      include: { pointDeVente: { select: { id: true, nom: true, rpvId: true } } },
    });
    if (!affectation) {
      return NextResponse.json({ error: "Aucun point de vente associé à cet agent" }, { status: 400 });
    }

    const pdvId = affectation.pointDeVente.id;
    const body  = await req.json();
    const { montantPaye, clientId, clientNom, clientTelephone, notes, lignes } = body;

    if (!lignes?.length) {
      return NextResponse.json({ error: "Au moins une ligne est obligatoire" }, { status: 400 });
    }

    // Part réglée depuis le compte courant client (CDC §8) — 0 par défaut.
    const ccMontantDemande = Math.max(0, Number(body.montantCompteCourant) || 0);

    // Segment du client enregistré (profil tarifaire / promos ciblées).
    const clientSegment = clientId
      ? (await prisma.client.findUnique({ where: { id: Number(clientId) }, select: { segment: true } }))?.segment ?? null
      : null;

    // ── Vérification stocks + TARIFICATION serveur (Catalogue §4/§9) ───────────
    type LigneInput = { produitId: number; quantite: number };
    let montantTotal = 0;
    const lignesData: Array<{
      produitId:    number;
      produitNom:   null;
      quantite:     number;
      prixUnitaire: number;
      montant:      number;
    }> = [];

    for (const l of lignes as LigneInput[]) {
      if (!l.produitId) {
        return NextResponse.json({ error: "produitId est obligatoire pour chaque ligne" }, { status: 400 });
      }
      const qte = Number(l.quantite);
      if (qte <= 0) return NextResponse.json({ error: "Quantité invalide" }, { status: 400 });

      const stock = await prisma.stockSite.findUnique({
        where: { produitId_pointDeVenteId: { produitId: Number(l.produitId), pointDeVenteId: pdvId } },
        include: { produit: { select: { id: true, nom: true, prixUnitaire: true, categorieId: true, familleId: true, marqueId: true } } },
      });
      const qteDispoReelle = (stock?.quantite ?? 0) - (stock?.quantiteReservee ?? 0);
      if (!stock || qteDispoReelle < qte) {
        // Rupture → proposer des équivalents disponibles au PDV (Catalogue Ent.#4).
        const substituts = await substitutsDisponibles(Number(l.produitId), pdvId);
        return NextResponse.json(
          { error: `Stock insuffisant pour "${stock?.produit.nom ?? `produit #${l.produitId}`}". Disponible : ${Math.max(0, qteDispoReelle)}`, substituts },
          { status: 400 }
        );
      }
      const tarif = await tariferLigne(stock.produit, qte, {
        pointDeVenteId: pdvId,
        clientId: clientId ? Number(clientId) : null,
        segment: clientSegment,
        aCredit: false,
      });
      montantTotal += tarif.montant;
      lignesData.push({ produitId: Number(l.produitId), produitNom: null, quantite: qte, prixUnitaire: tarif.prixUnitaire, montant: tarif.montant });
    }

    // Part CC (plafonnée au total) et reste à régler en espèces.
    const ccMontant   = Math.min(ccMontantDemande, montantTotal);
    const resteAPayer = montantTotal - ccMontant;

    if (ccMontant > 0) {
      if (!clientId) {
        return NextResponse.json({ error: "Un client enregistré est requis pour payer avec le compte courant." }, { status: 400 });
      }
      const cc = await getCompteCourantParClient(Number(clientId));
      if (!cc) return NextResponse.json({ error: "Ce client n'a pas de compte courant." }, { status: 422 });
      if (cc.statut !== "ACTIF") return NextResponse.json({ error: `Compte courant ${cc.statut.toLowerCase()} : paiement impossible.` }, { status: 422 });
      if (ccMontant > Number(cc.solde)) return NextResponse.json({ error: "Solde du compte courant insuffisant." }, { status: 422 });
      // Le paiement espèces doit couvrir au moins le reste (après part CC).
      if (Number(montantPaye ?? 0) < resteAPayer) {
        return NextResponse.json({ error: `Montant payé insuffisant : reste ${resteAPayer.toLocaleString("fr-FR")} FCFA à régler.` }, { status: 400 });
      }
    }

    const param = ccMontant > 0 ? await chargerParametrageCC() : null;
    const { ip, userAgent } = extraireMetaRequete(req);

    const vente = await prisma.$transaction(async (tx) => {
      const ref            = `VD-AT-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
      const montantPayeNum = Number(montantPaye ?? 0);
      const monnaieRendue  = Math.max(0, montantPayeNum - resteAPayer);

      const v = await tx.venteDirecte.create({
        data: {
          reference:       ref,
          statut:          "PAID",
          pointDeVenteId:  pdvId,
          vendeurId:       userId,
          modePaiement:    "ESPECES",
          montantTotal,
          montantPaye:     montantPayeNum,
          monnaieRendue,
          montantCompteCourant: ccMontant,
          notes:           notes || null,
          clientId:        clientId        ? Number(clientId)        : null,
          clientNom:       clientNom       || null,
          clientTelephone: clientTelephone || null,
          lignes:          { create: lignesData },
        },
      });

      const vLignes = await tx.ligneVenteDirecte.findMany({
        where: { venteId: v.id },
        select: { id: true, produitId: true, quantite: true },
      });

      // Décrémente stock + MouvementStock
      for (const ligne of vLignes) {
        if (!ligne.produitId) continue;
        await tx.stockSite.update({
          where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: pdvId } },
          data:  { quantite: { decrement: ligne.quantite } },
        });
        await tx.mouvementStock.create({
          data: {
            produitId:      ligne.produitId,
            pointDeVenteId: pdvId,
            type:           "SORTIE",
            typeSortie:     "VENTE_DIRECTE",
            quantite:       ligne.quantite,
            motif:          `Vente directe comptant ${ref}`,
            reference:      `${ref}-P${ligne.produitId}`,
            operateurId:    userId,
            venteDirecteId: v.id,
          },
        });
        // Déstockage FEFO best-effort (traçabilité lots/péremption, Enterprise #5).
        await consommerFEFOBestEffort(tx, {
          produitId: ligne.produitId, pointDeVenteId: pdvId, quantite: ligne.quantite,
          operateurId: userId, motif: `Vente directe comptant ${ref}`,
        });
      }

      // Prélèvement du compte courant (CDC §8) si une part est réglée via le CC.
      if (ccMontant > 0 && param) {
        await preleverCompteCourant(tx, {
          clientId: Number(clientId), montant: ccMontant, nature: "PAIEMENT_COMPTANT",
          venteId: v.id, refLibelle: `Vente comptant ${ref}`, userId, ip, userAgent, param,
        });
      }

      await auditLog(tx, userId, "VENTE_DIRECTE_COMPTANT", "VenteDirecte", v.id);
      await notifyRoles(tx, ["CAISSIER", "COMPTABLE", "RESPONSABLE_POINT_DE_VENTE"], {
        titre:     `Vente comptant enregistrée : ${ref}`,
        message:   `${session.user.prenom} ${session.user.nom} a réalisé une vente de ${montantTotal.toLocaleString("fr-FR")} FCFA sur "${affectation.pointDeVente.nom}".`,
        priorite:  PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/user/responsablesPointDeVente`,
      });

      return v;
    });

    return NextResponse.json({ data: vente }, { status: 201 });
  } catch (error) {
    console.error("POST /agentTerrain/ventes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
