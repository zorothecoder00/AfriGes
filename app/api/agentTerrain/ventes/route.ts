import { NextRequest, NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";
import { resolveViewAs } from "@/lib/viewAs";

/**
 * GET /api/agentTerrain/ventes
 * Ventes directes réalisées par l'agent terrain connecté.
 * Query: statut, dateDebut, dateFin, search, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const viewAs  = isAdmin ? resolveViewAs(req) : null;
    const effectiveUserId = viewAs?.userId ?? parseInt(session.user.id);

    // Trouver le PDV de l'agent via affectation active (ou du gestionnaire ciblé en viewAs)
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

    // Produits avec stock réellement disponible (quantite - quantiteReservee > 0)
    const allStocks = affectation
      ? await prisma.stockSite.findMany({
          where: { pointDeVenteId: affectation.pointDeVente.id, quantite: { gt: 0 } },
          include: { produit: { select: { id: true, nom: true, reference: true, unite: true, prixUnitaire: true } } },
        })
      : [];
    const produitsDispo = allStocks
      .map(s => ({ ...s, quantite: s.quantite - s.quantiteReservee }))
      .filter(s => s.quantite > 0);

    // Clients disponibles
    const clients = await prisma.client.findMany({
      where: { etat: "ACTIF", ...(affectation && { pointDeVenteId: affectation.pointDeVente.id }) },
      select: {
        id: true, nom: true, prenom: true, telephone: true,
        limiteCredit: true, soldeActuel: true,
        creditsClients: {
          where: { statut: { in: ["VALIDE", "ACTIF"] } },
          select: { id: true, reference: true, statut: true, montantTotal: true, montantConsomme: true },
          orderBy: { createdAt: "desc" },
        },
      },
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
 * Enregistrer une vente directe terrain.
 *
 * CAS COMPTANT (modePaiement !== CREDIT) :
 *   → statut PAID, stock décrémenté, caissier + RPV + comptable notifiés
 *   → produits hors catalogue interdits en comptant
 *
 * CAS CRÉDIT (modePaiement === CREDIT) :
 *   → clientId obligatoire
 *   → NOUVEAU FLUX (creditClientId fourni) :
 *       vérification montantTotal - montantConsomme >= montantVente
 *       produits hors catalogue acceptés (produitId null + produitNom + prixUnitaire)
 *       statut CREDIT_REQUEST lié au CreditClient
 *   → ANCIEN FLUX (sans creditClientId) :
 *       vérification limiteCredit - soldeActuel (comportement inchangé)
 *
 * Body: { modePaiement, montantPaye?, clientId?, clientNom?, clientTelephone?,
 *         notes?, creditClientId?,
 *         lignes: [{ produitId?, produitNom?, quantite, prixUnitaire? }] }
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
    const { modePaiement, montantPaye, clientId, clientNom, clientTelephone, notes, lignes, creditClientId } = body;

    if (!modePaiement || !lignes?.length) {
      return NextResponse.json({ error: "modePaiement et lignes sont obligatoires" }, { status: 400 });
    }

    const isCredit        = modePaiement === "CREDIT";
    const useNewCreditFlow = isCredit && !!creditClientId;

    // ── Validation client + crédit ─────────────────────────────────────────────
    let clientRecord: { id: number; nom: string; prenom: string; limiteCredit: unknown; soldeActuel: unknown } | null = null;
    let creditClientRecord: { id: number; montantTotal: unknown; montantConsomme: unknown; statut: string } | null = null;

    if (isCredit) {
      if (!clientId) {
        return NextResponse.json({ error: "Un client enregistré est obligatoire pour une vente à crédit" }, { status: 400 });
      }
      clientRecord = await prisma.client.findUnique({
        where: { id: Number(clientId) },
        select: { id: true, nom: true, prenom: true, limiteCredit: true, soldeActuel: true },
      });
      if (!clientRecord) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

      if (useNewCreditFlow) {
        creditClientRecord = await prisma.creditClient.findFirst({
          where: { id: Number(creditClientId), clientId: Number(clientId) },
          select: { id: true, montantTotal: true, montantConsomme: true, statut: true },
        });
        if (!creditClientRecord) {
          return NextResponse.json({ error: "Crédit introuvable ou n'appartient pas à ce client" }, { status: 404 });
        }
        if (!["VALIDE", "ACTIF"].includes(creditClientRecord.statut)) {
          return NextResponse.json(
            { error: `Ce crédit est en statut "${creditClientRecord.statut}", il ne peut pas être utilisé.` },
            { status: 400 }
          );
        }
      } else {
        if (!clientRecord.limiteCredit) {
          return NextResponse.json({ error: "Ce client n'a pas de limite de crédit définie. Contactez le Responsable Crédit." }, { status: 400 });
        }
      }
    }

    // ── Vérification stocks + calcul montant ──────────────────────────────────
    type LigneInput = { produitId?: number | null; produitNom?: string; quantite: number; prixUnitaire?: number };
    let montantTotal = 0;
    const lignesData: Array<{
      produitId:   number | null;
      produitNom:  string | null;
      quantite:    number;
      prixUnitaire: number;
      montant:     number;
    }> = [];

    for (const l of lignes as LigneInput[]) {
      const qte = Number(l.quantite);
      if (qte <= 0) return NextResponse.json({ error: "Quantité invalide" }, { status: 400 });

      if (!l.produitId) {
        // ── Hors catalogue (crédit uniquement) ───────────────────────────────
        if (!isCredit) {
          return NextResponse.json({ error: "Les produits hors catalogue sont uniquement autorisés pour les ventes à crédit" }, { status: 400 });
        }
        if (!l.produitNom?.trim()) {
          return NextResponse.json({ error: "produitNom est requis pour un produit hors catalogue" }, { status: 400 });
        }
        if (!l.prixUnitaire || Number(l.prixUnitaire) <= 0) {
          return NextResponse.json({ error: `Prix obligatoire pour le produit hors catalogue "${l.produitNom}"` }, { status: 400 });
        }
        const montantLigne = qte * Number(l.prixUnitaire);
        montantTotal += montantLigne;
        lignesData.push({ produitId: null, produitNom: l.produitNom.trim(), quantite: qte, prixUnitaire: Number(l.prixUnitaire), montant: montantLigne });
      } else {
        // ── Produit catalogue ────────────────────────────────────────────────
        const stock = await prisma.stockSite.findUnique({
          where: { produitId_pointDeVenteId: { produitId: Number(l.produitId), pointDeVenteId: pdvId } },
          include: { produit: { select: { nom: true, prixUnitaire: true } } },
        });
        const qteDispoReelle = (stock?.quantite ?? 0) - (stock?.quantiteReservee ?? 0);
        if (!stock || qteDispoReelle < qte) {
          return NextResponse.json(
            { error: `Stock insuffisant pour "${stock?.produit.nom ?? `produit #${l.produitId}`}". Disponible : ${Math.max(0, qteDispoReelle)}` },
            { status: 400 }
          );
        }
        const prix = Number(stock.produit.prixUnitaire);
        const montantLigne = qte * prix;
        montantTotal += montantLigne;
        lignesData.push({ produitId: Number(l.produitId), produitNom: null, quantite: qte, prixUnitaire: prix, montant: montantLigne });
      }
    }

    // ── Vérification disponibilité crédit ─────────────────────────────────────
    if (isCredit) {
      if (useNewCreditFlow && creditClientRecord) {
        const dispo = Number(creditClientRecord.montantTotal) - Number(creditClientRecord.montantConsomme);
        if (montantTotal > dispo) {
          return NextResponse.json(
            { error: `Solde crédit insuffisant. Disponible : ${dispo.toLocaleString("fr-FR")} FCFA — Demandé : ${montantTotal.toLocaleString("fr-FR")} FCFA` },
            { status: 400 }
          );
        }
      } else if (clientRecord) {
        const dispo = Number(clientRecord.limiteCredit) - Number(clientRecord.soldeActuel ?? 0);
        if (montantTotal > dispo) {
          return NextResponse.json(
            { error: `Crédit insuffisant. Disponible : ${dispo.toLocaleString("fr-FR")} FCFA — Demandé : ${montantTotal.toLocaleString("fr-FR")} FCFA` },
            { status: 400 }
          );
        }
      }
    }

    const vente = await prisma.$transaction(async (tx) => {
      const prefix         = isCredit ? "VD-CR" : "VD-AT";
      const ref            = `${prefix}-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
      const montantPayeNum = isCredit ? 0 : Number(montantPaye ?? 0);
      const monnaieRendue  = isCredit ? 0 : Math.max(0, montantPayeNum - montantTotal);

      const v = await tx.venteDirecte.create({
        data: {
          reference:       ref,
          statut:          isCredit ? "CREDIT_REQUEST" : "PAID",
          pointDeVenteId:  pdvId,
          vendeurId:       userId,
          modePaiement,
          montantTotal,
          montantPaye:     montantPayeNum,
          monnaieRendue,
          notes:           notes || null,
          clientId:        clientId        ? Number(clientId)        : null,
          clientNom:       clientNom       || null,
          clientTelephone: clientTelephone || null,
          creditClientId:  useNewCreditFlow ? Number(creditClientId) : null,
          lignes:          { create: lignesData },
        },
        include: { lignes: true },
      });

      if (!isCredit) {
        // ── COMPTANT : décrémente stock + MouvementStock ─────────────────────
        for (const ligne of v.lignes) {
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
        }
        await auditLog(tx, userId, "VENTE_DIRECTE_COMPTANT", "VenteDirecte", v.id);
        await notifyRoles(tx, ["CAISSIER", "COMPTABLE", "RESPONSABLE_POINT_DE_VENTE"], {
          titre:     `Vente comptant enregistrée : ${ref}`,
          message:   `${session.user.prenom} ${session.user.nom} a réalisé une vente de ${montantTotal.toLocaleString("fr-FR")} FCFA sur "${affectation.pointDeVente.nom}".`,
          priorite:  PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/responsablesPointDeVente`,
        });
      } else {
        // ── CRÉDIT : réserver stock pour les produits catalogue uniquement ────
        for (const ligne of v.lignes) {
          if (!ligne.produitId) continue; // hors catalogue : pas de stock à réserver
          await tx.stockSite.update({
            where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: pdvId } },
            data:  { quantiteReservee: { increment: ligne.quantite } },
          });
        }

        await auditLog(tx, userId, "VENTE_CREDIT_DEMANDEE", "VenteDirecte", v.id);

        const rvcsDuPdv = await tx.gestionnaireAffectation.findMany({
          where: {
            pointDeVenteId: pdvId,
            actif: true,
            user: { gestionnaire: { role: "RESPONSABLE_VENTE_CREDIT", actif: true } },
          },
          select: { userId: true },
        });

        const msgCredit = `${session.user.prenom} ${session.user.nom} demande une vente à crédit de ${montantTotal.toLocaleString("fr-FR")} FCFA pour ${clientRecord!.prenom} ${clientRecord!.nom} sur "${affectation.pointDeVente.nom}".`;

        if (rvcsDuPdv.length > 0) {
          await tx.notification.createMany({
            data: rvcsDuPdv.map(({ userId: uid }) => ({
              userId:    uid,
              titre:     `Demande crédit : ${ref}`,
              message:   msgCredit,
              priorite:  PrioriteNotification.HAUTE,
              actionUrl: `/dashboard/user/responsablesVenteCredit`,
            })),
            skipDuplicates: true,
          });
        }
        await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE"], {
          titre:     `Demande de vente à crédit : ${ref}`,
          message:   msgCredit,
          priorite:  PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/user/responsablesPointDeVente`,
        });
      }

      return v;
    });

    return NextResponse.json({ data: vente }, { status: 201 });
  } catch (error) {
    console.error("POST /agentTerrain/ventes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
