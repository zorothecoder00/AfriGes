import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/rpv/caisse-pdv
 * Récupère la caisse PDV (petite caisse) du RPV connecté, avec opérations récentes.
 */
export async function GET(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);

    // Trouver la caisse PDV active du RPV
    const caisse = await prisma.caissePDV.findFirst({
      where: { rpvId: userId, statut: "OUVERTE" },
      include: {
        pointDeVente: { select: { id: true, nom: true, code: true } },
        sessionCaisse:{ select: { id: true, caissierNom: true, statut: true } },
        operations: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        ventesDirectes: {
          where: { statut: "CONFIRMEE" },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, reference: true, montantTotal: true, montantPaye: true, createdAt: true },
        },
      },
    });

    if (!caisse) {
      // Retourner aussi les caisses fermées pour historique
      const historique = await prisma.caissePDV.findMany({
        where: { rpvId: userId },
        orderBy: { dateOuverture: "desc" },
        take: 5,
        include: { pointDeVente: { select: { id: true, nom: true } } },
      });
      return NextResponse.json({ data: null, historique, message: "Aucune caisse PDV ouverte" });
    }

    // Total des ventes du jour
    const debut = new Date(); debut.setHours(0, 0, 0, 0);
    const ventesJour = await prisma.venteDirecte.aggregate({
      where: { caissePDVId: caisse.id, statut: "CONFIRMEE", createdAt: { gte: debut } },
      _sum: { montantTotal: true },
      _count: true,
    });

    return NextResponse.json({
      data: caisse,
      stats: {
        ventesAujourdHui: ventesJour._count,
        montantAujourdHui: Number(ventesJour._sum.montantTotal ?? 0),
      },
    });
  } catch (error) {
    console.error("GET /rpv/caisse-pdv:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/rpv/caisse-pdv
 * Ouvrir ou créer une caisse PDV pour le RPV.
 * Body: { fondsCaisse, sessionCaisseId?, notes? }
 */
export async function POST(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const { fondsCaisse, sessionCaisseId, notes } = await req.json();

    // Vérifier que le RPV a un PDV
    const pdv = await prisma.pointDeVente.findUnique({ where: { rpvId: userId } });
    if (!pdv) {
      return NextResponse.json({ error: "Aucun point de vente associé à ce RPV" }, { status: 400 });
    }

    // Vérifier pas de caisse déjà ouverte
    const existante = await prisma.caissePDV.findFirst({
      where: { rpvId: userId, statut: "OUVERTE" },
    });
    if (existante) {
      return NextResponse.json({ error: "Une caisse PDV est déjà ouverte" }, { status: 409 });
    }

    const caisse = await prisma.$transaction(async (tx) => {
      const c = await tx.caissePDV.create({
        data: {
          nom:            `Caisse ${pdv.nom} — ${session.user.prenom} ${session.user.nom}`,
          rpvId:          userId,
          pointDeVenteId: pdv.id,
          sessionCaisseId:sessionCaisseId ? Number(sessionCaisseId) : null,
          fondsCaisse:    Number(fondsCaisse) || 0,
          statut:         "OUVERTE",
          notes:          notes || null,
        },
        include: { pointDeVente: { select: { nom: true } } },
      });

      await auditLog(tx, userId, "CAISSE_PDV_OUVERTE", "CaissePDV", c.id);

      await notifyRoles(tx, ["CAISSIER"], {
        titre:    `Caisse PDV ouverte — ${pdv.nom}`,
        message:  `${session.user.prenom} ${session.user.nom} a ouvert sa caisse PDV avec ${Number(fondsCaisse)} FCFA de fonds.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl:`/dashboard/rpv/caisse`,
      });

      return c;
    });

    return NextResponse.json({ data: caisse }, { status: 201 });
  } catch (error) {
    console.error("POST /rpv/caisse-pdv:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/rpv/caisse-pdv
 * Enregistrer une opération sur la caisse PDV (encaissement / décaissement).
 * Body: { type, montant, motif, mode?, categorie? }
 * Ou fermer la caisse : { action: "FERMER", soldeReel? }
 */
export async function PATCH(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const body = await req.json();
    const { action, type, montant, motif, mode, categorie, soldeReel } = body;

    const caisse = await prisma.caissePDV.findFirst({
      where: { rpvId: userId, statut: "OUVERTE" },
    });
    if (!caisse) return NextResponse.json({ error: "Aucune caisse PDV ouverte" }, { status: 404 });

    // ─ Fermer la caisse ──────────────────────────────────────
    if (action === "FERMER") {
      const updated = await prisma.$transaction(async (tx) => {
        const c = await tx.caissePDV.update({
          where: { id: caisse.id },
          data: { statut: "FERMEE", dateFermeture: new Date() },
        });
        await auditLog(tx, userId, "CAISSE_PDV_FERMEE", "CaissePDV", c.id);
        return c;
      });
      return NextResponse.json({ data: updated });
    }

    // ─ Enregistrer une opération ─────────────────────────────
    if (!type || !montant || !motif) {
      return NextResponse.json({ error: "type, montant, motif sont obligatoires" }, { status: 400 });
    }

    const operation = await prisma.$transaction(async (tx) => {
      const op = await tx.operationCaissePDV.create({
        data: {
          caissePDVId:  caisse.id,
          type,
          montant:      Number(montant),
          motif,
          mode:         mode      || null,
          categorie:    categorie || null,
          reference:    `OPP-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`,
          operateurNom: `${session.user.prenom} ${session.user.nom}`,
          operateurId:  userId,
        },
      });

      // Mettre à jour le solde de la caisse
      const delta = type === "ENCAISSEMENT" ? Number(montant) : -Number(montant);
      await tx.caissePDV.update({
        where: { id: caisse.id },
        data: { fondsCaisse: { increment: delta } },
      });

      return op;
    });

    return NextResponse.json({ data: operation });
  } catch (error) {
    console.error("PATCH /rpv/caisse-pdv:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
