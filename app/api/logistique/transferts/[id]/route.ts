import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

async function getSession() {
  return (await getLogistiqueSession()) ?? (await getMagasinierSession());
}

/**
 * GET /api/logistique/transferts/[id]
 * Détail d'un transfert.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    const transfert = await prisma.transfertStock.findUnique({
      where: { id: Number(id) },
      include: {
        origine:     { select: { id: true, nom: true, code: true, type: true } },
        destination: { select: { id: true, nom: true, code: true, type: true } },
        creePar:     { select: { id: true, nom: true, prenom: true } },
        validePar:   { select: { id: true, nom: true, prenom: true } },
        lignes: {
          include: { produit: { select: { id: true, nom: true, reference: true, unite: true, prixUnitaire: true } } },
        },
      },
    });

    if (!transfert) return NextResponse.json({ error: "Transfert introuvable" }, { status: 404 });
    return NextResponse.json({ data: transfert });
  } catch (error) {
    console.error("GET /logistique/transferts/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/logistique/transferts/[id]
 * Changer le statut d'un transfert.
 * - action "EXPEDIER"   → EN_COURS → EXPEDIE
 * - action "RECEVOIR"   → EXPEDIE  → RECU (incrément stock destination + mouvements)
 * - action "ANNULER"    → EN_COURS/EXPEDIE → ANNULE (remettre stock origine)
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    const { action, notes } = await req.json();

    const transfert = await prisma.transfertStock.findUnique({
      where: { id: Number(id) },
      include: {
        lignes: true,
        origine:     { select: { nom: true } },
        destination: { select: { nom: true } },
      },
    });
    if (!transfert) return NextResponse.json({ error: "Transfert introuvable" }, { status: 404 });

    if (action === "EXPEDIER") {
      if (transfert.statut !== "EN_COURS") {
        return NextResponse.json({ error: "Seul un transfert EN_COURS peut être expédié" }, { status: 400 });
      }
      const updated = await prisma.transfertStock.update({
        where: { id: Number(id) },
        data: { statut: "EXPEDIE", dateExpedition: new Date(), notes: notes || transfert.notes },
      });
      return NextResponse.json({ data: updated });
    }

    if (action === "RECEVOIR") {
      if (transfert.statut !== "EXPEDIE" && transfert.statut !== "EN_COURS") {
        return NextResponse.json({ error: "Ce transfert ne peut pas être marqué reçu" }, { status: 400 });
      }

      const result = await prisma.$transaction(async (tx) => {
        for (const l of transfert.lignes) {
          await tx.stockSite.upsert({
            where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: transfert.destinationId } },
            update: { quantite: { increment: l.quantite } },
            create: { produitId: l.produitId, pointDeVenteId: transfert.destinationId, quantite: l.quantite },
          });
          await tx.mouvementStock.create({
            data: {
              produitId:       l.produitId,
              pointDeVenteId:  transfert.destinationId,
              type:            "ENTREE",
              typeEntree:      "TRANSFERT_ENTRANT",
              quantite:        l.quantite,
              motif:           `Réception transfert ${transfert.reference} depuis ${transfert.origine.nom}`,
              reference:       `${transfert.reference}-IN-P${l.produitId}-${randomUUID().slice(0,4).toUpperCase()}`,
              operateurId:     parseInt(session.user.id),
              transfertStockId:Number(id),
            },
          });
        }

        const t = await tx.transfertStock.update({
          where: { id: Number(id) },
          data: {
            statut:        "RECU",
            dateReception: new Date(),
            valideParId:   parseInt(session.user.id),
            notes:         notes || transfert.notes,
          },
        });

        await auditLog(tx, parseInt(session.user.id), "TRANSFERT_RECU", "TransfertStock", t.id);

        await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {
          titre:    `Transfert reçu : ${transfert.reference}`,
          message:  `${session.user.prenom} ${session.user.nom} a confirmé la réception du transfert "${transfert.reference}" à "${transfert.destination.nom}".`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl:`/dashboard/logistique/transferts/${id}`,
        });

        return t;
      });

      return NextResponse.json({ data: result });
    }

    if (action === "ANNULER") {
      if (!["EN_COURS", "EXPEDIE"].includes(transfert.statut)) {
        return NextResponse.json({ error: "Ce transfert ne peut pas être annulé" }, { status: 400 });
      }

      const result = await prisma.$transaction(async (tx) => {
        // Restituer le stock à l'origine (si déjà sorti)
        for (const l of transfert.lignes) {
          await tx.stockSite.update({
            where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: transfert.origineId } },
            data: { quantite: { increment: l.quantite } },
          });
          await tx.mouvementStock.create({
            data: {
              produitId:       l.produitId,
              pointDeVenteId:  transfert.origineId,
              type:            "ENTREE",
              typeEntree:      "AJUSTEMENT_POSITIF",
              quantite:        l.quantite,
              motif:           `Annulation transfert ${transfert.reference}`,
              reference:       `${transfert.reference}-CANCEL-P${l.produitId}-${randomUUID().slice(0,4).toUpperCase()}`,
              operateurId:     parseInt(session.user.id),
            },
          });
        }

        const t = await tx.transfertStock.update({
          where: { id: Number(id) },
          data: { statut: "ANNULE", notes: notes || transfert.notes },
        });

        await auditLog(tx, parseInt(session.user.id), "TRANSFERT_ANNULE", "TransfertStock", t.id);
        return t;
      });

      return NextResponse.json({ data: result });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /logistique/transferts/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
