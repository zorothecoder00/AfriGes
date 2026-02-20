import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/caissier/cloture
 *
 * Retourne :
 *  - L'état de la journée en cours (ventes, montants, etc.)
 *  - L'historique des clôtures passées (paginé)
 *  - Si la journée en cours a déjà été clôturée
 */
export async function GET(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(30, Math.max(5, Number(searchParams.get("limit") ?? "10")));

    const now        = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Ventes du jour
    const ventesJour = await prisma.venteCreditAlimentaire.findMany({
      where: { createdAt: { gte: startOfDay, lte: endOfDay } },
      select: {
        id: true,
        quantite: true,
        prixUnitaire: true,
        createdAt: true,
        produit: { select: { nom: true } },
        creditAlimentaire: {
          select: {
            member: { select: { nom: true, prenom: true } },
            client: { select: { nom: true, prenom: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const totalVentes  = ventesJour.length;
    const montantTotal = ventesJour.reduce((s, v) => s + Number(v.prixUnitaire) * v.quantite, 0);
    const panierMoyen  = totalVentes > 0 ? montantTotal / totalVentes : 0;

    // Clients distincts
    const clientsSet = new Set(
      ventesJour
        .map((v) => v.creditAlimentaire?.member?.nom ?? v.creditAlimentaire?.client?.nom ?? null)
        .filter(Boolean)
    );
    const nbClients = clientsSet.size;

    // Clôture déjà faite aujourd'hui ?
    const clotureDuJour = await prisma.clotureCaisse.findFirst({
      where: { date: { gte: startOfDay, lte: endOfDay } },
    });

    // Bilan par produit
    const bilanProduits: Record<string, { nom: string; quantite: number; montant: number }> = {};
    for (const v of ventesJour) {
      const nom = v.produit.nom;
      if (!bilanProduits[nom]) bilanProduits[nom] = { nom, quantite: 0, montant: 0 };
      bilanProduits[nom].quantite += v.quantite;
      bilanProduits[nom].montant  += Number(v.prixUnitaire) * v.quantite;
    }
    const bilanParProduit = Object.values(bilanProduits).sort((a, b) => b.montant - a.montant);

    // Historique clôtures (paginé)
    const [clotures, totalClotures] = await Promise.all([
      prisma.clotureCaisse.findMany({
        orderBy: { date: "desc" },
        skip:  (page - 1) * limit,
        take:  limit,
      }),
      prisma.clotureCaisse.count(),
    ]);

    return NextResponse.json({
      success: true,
      jourEnCours: {
        date:        startOfDay.toISOString(),
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
        ventesDetail: ventesJour.map((v) => {
          const person = v.creditAlimentaire?.client ?? v.creditAlimentaire?.member;
          return {
            id:         v.id,
            produit:    v.produit.nom,
            quantite:   v.quantite,
            montant:    Number(v.prixUnitaire) * v.quantite,
            clientNom:  person ? `${person.prenom} ${person.nom}` : "—",
            heure:      new Date(v.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
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
 * Idempotent : si la journée est déjà clôturée, retourne une erreur.
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

    // Calculer les stats du jour
    const ventesJour = await prisma.venteCreditAlimentaire.findMany({
      where: { createdAt: { gte: startOfDay, lte: endOfDay } },
      select: { quantite: true, prixUnitaire: true, creditAlimentaire: { select: { memberId: true, clientId: true } } },
    });

    const totalVentes  = ventesJour.length;
    const montantTotal = ventesJour.reduce((s, v) => s + Number(v.prixUnitaire) * v.quantite, 0);
    const panierMoyen  = totalVentes > 0 ? montantTotal / totalVentes : 0;

    const clientsSet = new Set(
      ventesJour.map((v) => {
        const ca = v.creditAlimentaire;
        if (!ca) return null;
        return ca.memberId ? `m${ca.memberId}` : ca.clientId ? `c${ca.clientId}` : null;
      }).filter(Boolean)
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

      // Notifications : Admin + RPV + Comptable
      const dateStr = startOfDay.toLocaleDateString("fr-FR");
      await notifyRoles(
        tx,
        ["RESPONSABLE_POINT_DE_VENTE", "COMPTABLE"],
        {
          titre:    `Clôture de caisse — ${dateStr}`,
          message:  `${caissierNom} a effectué la clôture de caisse du ${dateStr} : ${totalVentes} vente(s) pour un total de ${montantTotal.toLocaleString("fr-FR")} FCFA (${nbClients} client(s) servi(s)).`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/admin/ventes`,
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
