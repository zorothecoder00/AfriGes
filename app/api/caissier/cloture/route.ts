import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId, souscriptionPdvWhere } from "@/lib/authCaissier";
import { getRPVSession } from "@/lib/authRPV";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/caissier/cloture
 *
 * Retourne :
 *  - L'état de la journée en cours (versements packs collectés) — scoped au PDV du caissier
 *  - L'historique des clôtures passées (paginé) — scoped au PDV du caissier
 *  - Si la journée en cours a déjà été clôturée
 */
export async function GET(req: Request) {
  try {
    const session = (await getCaissierSession()) ?? (await getRPVSession());
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get("page")  ?? "1"));
    const limit = Math.min(30, Math.max(5, Number(searchParams.get("limit") ?? "10")));

    const now        = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Filtre souscription PDV (si caissier)
    const souscriptionFilter = pdvId ? souscriptionPdvWhere(pdvId) : {};
    // Filtre opérations via session du caissier
    const sessionFilter = isAdmin ? {} : { session: { caissierId: userId } };

    // Versements packs collectés aujourd'hui — scoped au PDV
    const versementsJour = await prisma.versementPack.findMany({
      where: {
        datePaiement: { gte: startOfDay, lte: endOfDay },
        souscription: souscriptionFilter,
      },
      orderBy: { datePaiement: "asc" },
      include: {
        souscription: {
          include: {
            pack:   { select: { nom: true, type: true } },
            client: { select: { nom: true, prenom: true } },
            user:   { select: { nom: true, prenom: true } },
          },
        },
      },
    });

    // Opérations caisse du jour — scoped au caissier via session
    const operationsJour = await prisma.operationCaisse.findMany({
      where: { ...sessionFilter, createdAt: { gte: startOfDay, lte: endOfDay } },
      orderBy: { createdAt: "asc" },
    });
    const encaissementsJour = operationsJour.filter((o) => o.type === "ENCAISSEMENT");
    const decaissementsJour = operationsJour.filter((o) => o.type === "DECAISSEMENT");
    const totalEncaissementsAutres = encaissementsJour.reduce((s, o) => s + Number(o.montant), 0);
    const totalDecaissements       = decaissementsJour.reduce((s, o) => s + Number(o.montant), 0);

    const totalVentes  = versementsJour.length;
    const montantTotal = versementsJour.reduce((s, v) => s + Number(v.montant), 0);
    const panierMoyen  = totalVentes > 0 ? montantTotal / totalVentes : 0;

    // Clients distincts ayant versé aujourd'hui
    const clientsSet = new Set(
      versementsJour
        .map((v) => {
          const s = v.souscription;
          return s.clientId ? `c${s.clientId}` : s.userId ? `u${s.userId}` : null;
        })
        .filter(Boolean)
    );
    const nbClients = clientsSet.size;

    // Clôture déjà effectuée aujourd'hui pour ce PDV/caissier ?
    const clotureDuJour = await prisma.clotureCaisse.findFirst({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        ...(isAdmin ? {} : pdvId ? { pointDeVenteId: pdvId } : { session: { caissierId: userId } }),
      },
    });

    // Bilan par pack
    const bilanPacks: Record<string, { nom: string; quantite: number; montant: number }> = {};
    for (const v of versementsJour) {
      const nom = v.souscription.pack.nom;
      if (!bilanPacks[nom]) bilanPacks[nom] = { nom, quantite: 0, montant: 0 };
      bilanPacks[nom].quantite += 1;
      bilanPacks[nom].montant  += Number(v.montant);
    }
    const bilanParProduit = Object.values(bilanPacks).sort((a, b) => b.montant - a.montant);

    // Historique clôtures — scoped au PDV du caissier
    const cloturesWhere = isAdmin
      ? {}
      : pdvId
        ? { pointDeVenteId: pdvId }
        : { session: { caissierId: userId } };

    const [clotures, totalClotures] = await Promise.all([
      prisma.clotureCaisse.findMany({
        where:   cloturesWhere,
        orderBy: { date: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.clotureCaisse.count({ where: cloturesWhere }),
    ]);

    return NextResponse.json({
      success: true,
      jourEnCours: {
        date:          startOfDay.toISOString(),
        totalVentes,
        montantTotal,
        panierMoyen,
        nbClients,
        dejaClothuree: !!clotureDuJour,
        clotureDuJour: clotureDuJour
          ? {
              ...clotureDuJour,
              date:         clotureDuJour.date.toISOString(),
              montantTotal: Number(clotureDuJour.montantTotal),
              panierMoyen:  Number(clotureDuJour.panierMoyen),
            }
          : null,
        bilanParProduit,
        totalEncaissementsAutres,
        totalDecaissements,
        ventesDetail: versementsJour.map((v) => {
          const person = v.souscription.client ?? v.souscription.user;
          return {
            id:        v.id,
            produit:   v.souscription.pack.nom,
            quantite:  1,
            montant:   Number(v.montant),
            clientNom: person ? `${person.prenom} ${person.nom}` : "—",
            heure:     new Date(v.datePaiement).toLocaleTimeString("fr-FR", {
              hour:   "2-digit",
              minute: "2-digit",
            }),
          };
        }),
        encaissementsDetail: encaissementsJour.map((o) => ({
          id:        o.id,
          reference: o.reference,
          montant:   Number(o.montant),
          motif:     o.motif,
          mode:      o.mode,
          operateur: o.operateurNom,
          heure:     new Date(o.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        })),
        decaissementsDetail: decaissementsJour.map((o) => ({
          id:             o.id,
          reference:      o.reference,
          montant:        Number(o.montant),
          motif:          o.motif,
          categorie:      o.categorie,
          operateur:      o.operateurNom,
          heure:          new Date(o.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        })),
      },
      historique: {
        data: clotures.map((c) => ({
          ...c,
          date:         c.date.toISOString(),
          montantTotal: Number(c.montantTotal),
          panierMoyen:  Number(c.panierMoyen),
          createdAt:    c.createdAt.toISOString(),
        })),
        meta: {
          total:      totalClotures,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(totalClotures / limit)),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/caissier/cloture error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/caissier/cloture
 *
 * Crée la clôture de la journée en cours.
 * Idempotent : erreur 409 si déjà clôturée.
 * Body : { notes?, soldeReel? }
 */
export async function POST(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    const body     = await req.json().catch(() => ({}));
    const notes    = typeof body.notes === "string" ? body.notes.trim() || null : null;
    const soldeReel = body.soldeReel !== undefined && body.soldeReel !== "" ? Number(body.soldeReel) : null;

    const now        = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Session active du caissier
    const sessionActive = await prisma.sessionCaisse.findFirst({
      where: {
        statut: { in: ["OUVERTE", "SUSPENDUE"] },
        ...(isAdmin ? {} : { caissierId: userId }),
      },
      orderBy: { createdAt: "desc" },
    });

    // Vérifier si déjà clôturée pour ce PDV/caissier aujourd'hui
    const clotureCheck = isAdmin
      ? { date: { gte: startOfDay, lte: endOfDay } }
      : pdvId
        ? { date: { gte: startOfDay, lte: endOfDay }, pointDeVenteId: pdvId }
        : { date: { gte: startOfDay, lte: endOfDay }, session: { caissierId: userId } };

    const existante = await prisma.clotureCaisse.findFirst({ where: clotureCheck });
    if (existante) {
      return NextResponse.json(
        { message: "La caisse de ce jour a déjà été clôturée" },
        { status: 409 }
      );
    }

    // Filtre souscription PDV
    const souscriptionFilter = pdvId ? souscriptionPdvWhere(pdvId) : {};
    const sessionFilter = isAdmin ? {} : { session: { caissierId: userId } };

    // Stats VersementPack du jour — scoped au PDV
    const versementsJour = await prisma.versementPack.findMany({
      where: {
        datePaiement: { gte: startOfDay, lte: endOfDay },
        souscription: souscriptionFilter,
      },
      include: { souscription: { select: { clientId: true, userId: true } } },
    });
    const totalVentes  = versementsJour.length;
    const montantTotal = versementsJour.reduce((s, v) => s + Number(v.montant), 0);
    const panierMoyen  = totalVentes > 0 ? montantTotal / totalVentes : 0;
    const clientsSet   = new Set(
      versementsJour
        .map((v) => {
          const s = v.souscription;
          return s.clientId ? `c${s.clientId}` : s.userId ? `u${s.userId}` : null;
        })
        .filter(Boolean)
    );
    const nbClients = clientsSet.size;

    const fondsCaisse = sessionActive ? Number(sessionActive.fondsCaisse) : 0;

    // Agrégats OperationCaisse du jour — scoped au caissier
    const [encaissAgg, decaissAgg, transfertAgg] = await Promise.all([
      prisma.operationCaisse.aggregate({
        _sum: { montant: true },
        where: { ...sessionFilter, type: "ENCAISSEMENT", createdAt: { gte: startOfDay, lte: endOfDay } },
      }),
      prisma.operationCaisse.aggregate({
        _sum: { montant: true },
        where: { ...sessionFilter, type: "DECAISSEMENT", createdAt: { gte: startOfDay, lte: endOfDay } },
      }),
      prisma.transfertCaisse.aggregate({
        _sum: { montant: true },
        where: { ...sessionFilter, createdAt: { gte: startOfDay, lte: endOfDay } },
      }),
    ]);

    const totalEncaissementsAutres = Number(encaissAgg._sum.montant ?? 0);
    const totalDecaissements       = Number(decaissAgg._sum.montant ?? 0);
    const totalTransferts          = Number(transfertAgg._sum.montant ?? 0);
    const soldeTheorique           = fondsCaisse + montantTotal + totalEncaissementsAutres - totalDecaissements - totalTransferts;
    const ecart                    = soldeReel !== null ? soldeReel - soldeTheorique : null;

    const caissierNom = session.user.name ?? "Caissier";

    const cloture = await prisma.$transaction(async (tx) => {
      const created = await tx.clotureCaisse.create({
        data: {
          date:                    startOfDay,
          caissierNom,
          pointDeVenteId:          sessionActive?.pointDeVenteId ?? pdvId ?? null,
          totalVentes,
          montantTotal:            new Prisma.Decimal(montantTotal),
          panierMoyen:             new Prisma.Decimal(panierMoyen),
          nbClients,
          notes,
          sessionId:               sessionActive?.id ?? null,
          fondsCaisse:             new Prisma.Decimal(fondsCaisse),
          totalEncaissementsAutres: new Prisma.Decimal(totalEncaissementsAutres),
          totalDecaissements:      new Prisma.Decimal(totalDecaissements),
          totalTransferts:         new Prisma.Decimal(totalTransferts),
          soldeTheorique:          new Prisma.Decimal(soldeTheorique),
          soldeReel:               soldeReel !== null ? new Prisma.Decimal(soldeReel) : null,
          ecart:                   ecart !== null ? new Prisma.Decimal(ecart) : null,
        },
      });

      // Fermer la session si elle existe
      if (sessionActive) {
        await tx.sessionCaisse.update({
          where: { id: sessionActive.id },
          data:  { statut: "FERMEE", dateFermeture: now },
        });
      }

      await auditLog(tx, userId, "CLOTURE_CAISSE", "ClotureCaisse", created.id);

      const dateStr = startOfDay.toLocaleDateString("fr-FR");
      await notifyRoles(
        tx,
        ["RESPONSABLE_POINT_DE_VENTE", "COMPTABLE"],
        {
          titre:    `Clôture de caisse — ${dateStr}`,
          message:  `${caissierNom} a clôturé la caisse du ${dateStr}. Solde théorique : ${soldeTheorique.toLocaleString("fr-FR")} FCFA${ecart !== null ? ` | Écart : ${ecart.toLocaleString("fr-FR")} FCFA` : ""}.`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: "/dashboard/admin/ventes",
        }
      );

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Clôture de caisse enregistrée avec succès",
        data: {
          ...cloture,
          date:                    cloture.date.toISOString(),
          montantTotal:            Number(cloture.montantTotal),
          panierMoyen:             Number(cloture.panierMoyen),
          fondsCaisse:             Number(cloture.fondsCaisse),
          totalEncaissementsAutres: Number(cloture.totalEncaissementsAutres),
          totalDecaissements:      Number(cloture.totalDecaissements),
          totalTransferts:         Number(cloture.totalTransferts),
          soldeTheorique:          Number(cloture.soldeTheorique),
          soldeReel:               cloture.soldeReel !== null ? Number(cloture.soldeReel) : null,
          ecart:                   cloture.ecart !== null ? Number(cloture.ecart) : null,
          createdAt:               cloture.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/caissier/cloture error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
