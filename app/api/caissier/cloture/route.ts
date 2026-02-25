import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";
import { getRPVSession } from "@/lib/authRPV";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/caissier/cloture
 *
 * Retourne :
 *  - L'état de la journée en cours (versements packs collectés)
 *  - L'historique des clôtures passées (paginé)
 *  - Si la journée en cours a déjà été clôturée
 */
export async function GET(req: Request) {
  try {
    const session = (await getCaissierSession()) ?? (await getRPVSession());
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get("page")  ?? "1"));
    const limit = Math.min(30, Math.max(5, Number(searchParams.get("limit") ?? "10")));

    const now        = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Versements packs collectés aujourd'hui
    const versementsJour = await prisma.versementPack.findMany({
      where: { datePaiement: { gte: startOfDay, lte: endOfDay } },
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

    // Clôture déjà effectuée aujourd'hui ?
    const clotureDuJour = await prisma.clotureCaisse.findFirst({
      where: { date: { gte: startOfDay, lte: endOfDay } },
    });

    // Bilan par pack (remplace bilanParProduit)
    const bilanPacks: Record<string, { nom: string; quantite: number; montant: number }> = {};
    for (const v of versementsJour) {
      const nom = v.souscription.pack.nom;
      if (!bilanPacks[nom]) bilanPacks[nom] = { nom, quantite: 0, montant: 0 };
      bilanPacks[nom].quantite += 1;
      bilanPacks[nom].montant  += Number(v.montant);
    }
    const bilanParProduit = Object.values(bilanPacks).sort((a, b) => b.montant - a.montant);

    // Historique clôtures (paginé)
    const [clotures, totalClotures] = await Promise.all([
      prisma.clotureCaisse.findMany({
        orderBy: { date: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.clotureCaisse.count(),
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
        ventesDetail: versementsJour.map((v) => {
          const person = v.souscription.client ?? v.souscription.user;
          return {
            id:        v.id,
            produit:   v.souscription.pack.nom,  // label du pack (affiché comme "produit")
            quantite:  1,
            montant:   Number(v.montant),
            clientNom: person ? `${person.prenom} ${person.nom}` : "—",
            heure:     new Date(v.datePaiement).toLocaleTimeString("fr-FR", {
              hour:   "2-digit",
              minute: "2-digit",
            }),
          };
        }),
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
 * Calcule les stats à partir des VersementPack du jour.
 * Body : { notes? }
 */
export async function POST(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const body  = await req.json().catch(() => ({}));
    const notes = typeof body.notes === "string" ? body.notes.trim() : null;

    const now        = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Vérifier si déjà clôturée
    const existante = await prisma.clotureCaisse.findFirst({
      where: { date: { gte: startOfDay, lte: endOfDay } },
    });
    if (existante) {
      return NextResponse.json(
        { message: "La caisse de ce jour a déjà été clôturée" },
        { status: 409 }
      );
    }

    // Stats du jour depuis VersementPack
    const versementsJour = await prisma.versementPack.findMany({
      where: { datePaiement: { gte: startOfDay, lte: endOfDay } },
      include: {
        souscription: { select: { clientId: true, userId: true } },
      },
    });

    const totalVentes  = versementsJour.length;
    const montantTotal = versementsJour.reduce((s, v) => s + Number(v.montant), 0);
    const panierMoyen  = totalVentes > 0 ? montantTotal / totalVentes : 0;

    const clientsSet = new Set(
      versementsJour
        .map((v) => {
          const s = v.souscription;
          return s.clientId ? `c${s.clientId}` : s.userId ? `u${s.userId}` : null;
        })
        .filter(Boolean)
    );
    const nbClients = clientsSet.size;

    const caissierNom = session.user.name ?? "Caissier";

    const cloture = await prisma.$transaction(async (tx) => {
      const created = await tx.clotureCaisse.create({
        data: {
          date:         startOfDay,
          caissierNom,
          totalVentes,
          montantTotal: new Prisma.Decimal(montantTotal),
          panierMoyen:  new Prisma.Decimal(panierMoyen),
          nbClients,
          notes:        notes ?? undefined,
        },
      });

      // Audit log
      await auditLog(tx, parseInt(session.user.id), "CLOTURE_CAISSE", "ClotureCaisse", created.id);

      // Notifications : Admin + RPV (haute priorité) + Comptable
      const dateStr = startOfDay.toLocaleDateString("fr-FR");
      await notifyRoles(
        tx,
        ["RESPONSABLE_POINT_DE_VENTE", "COMPTABLE"],
        {
          titre:    `Clôture de caisse — ${dateStr}`,
          message:  `${caissierNom} a effectué la clôture de caisse du ${dateStr} : ${totalVentes} versement(s) collecté(s) pour un total de ${montantTotal.toLocaleString("fr-FR")} FCFA (${nbClients} client(s) servi(s)).`,
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
          date:         cloture.date.toISOString(),
          montantTotal: Number(cloture.montantTotal),
          panierMoyen:  Number(cloture.panierMoyen),
          createdAt:    cloture.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/caissier/cloture error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
