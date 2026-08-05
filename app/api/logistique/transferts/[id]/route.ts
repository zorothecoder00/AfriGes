import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { randomUUID } from "crypto";
import { notify, notifyRoles, auditLog } from "@/lib/notifications";
import { comptabiliserTransfertRecu } from "@/lib/comptabilite/ecrituresTransfert";
import { getRequestMeta } from "@/lib/requestMeta";

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
 * - action "VALIDER"    → DEMANDE  → EN_COURS (CDC §13 étape 2 — l'appro central
 *   choisit l'agence source, exécute alors le décrément stock, comme une
 *   création directe de transfert)
 * - action "REJETER"    → DEMANDE  → ANNULE (aucun stock n'a encore bougé)
 * - action "EXPEDIER"   → EN_COURS → EXPEDIE
 * - action "RECEVOIR"   → EXPEDIE  → RECU (incrément stock destination + mouvements)
 * - action "ANNULER"    → EN_COURS/EXPEDIE → ANNULE (remettre stock origine)
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    const { action, notes, origineId } = await req.json();

    const transfert = await prisma.transfertStock.findUnique({
      where: { id: Number(id) },
      include: {
        lignes: true,
        origine:     { select: { nom: true } },
        destination: { select: { nom: true } },
      },
    });
    if (!transfert) return NextResponse.json({ error: "Transfert introuvable" }, { status: 404 });

    if (action === "VALIDER") {
      if (transfert.statut !== "DEMANDE") {
        return NextResponse.json({ error: "Seule une demande peut être validée" }, { status: 400 });
      }
      if (!origineId) return NextResponse.json({ error: "origineId est obligatoire" }, { status: 400 });
      if (Number(origineId) === transfert.destinationId) {
        return NextResponse.json({ error: "L'origine et la destination doivent être différents" }, { status: 400 });
      }

      // Vérifier stocks réellement disponibles à l'origine choisie (même contrôle qu'à la création directe)
      for (const l of transfert.lignes) {
        const stock = await prisma.stockSite.findUnique({
          where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: Number(origineId) } },
          include: { produit: { select: { nom: true } } },
        });
        const qteDispo = (stock?.quantite ?? 0) - (stock?.quantiteReservee ?? 0);
        if (!stock || qteDispo < l.quantite) {
          return NextResponse.json(
            { error: `Stock insuffisant pour "${stock?.produit.nom ?? l.produitId}" sur l'agence source. Disponible : ${qteDispo < 0 ? 0 : qteDispo}, demandé : ${l.quantite}` },
            { status: 400 }
          );
        }
      }

      const origine = await prisma.pointDeVente.findUnique({ where: { id: Number(origineId) }, select: { nom: true } });
      if (!origine) return NextResponse.json({ error: "Agence source introuvable" }, { status: 404 });

      const updated = await prisma.$transaction(async (tx) => {
        for (const l of transfert.lignes) {
          await tx.stockSite.update({
            where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: Number(origineId) } },
            data: { quantite: { decrement: l.quantite } },
          });
          await tx.stockSite.upsert({
            where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: transfert.destinationId } },
            update: { quantiteEnTransit: { increment: l.quantite } },
            create: { produitId: l.produitId, pointDeVenteId: transfert.destinationId, quantiteEnTransit: l.quantite },
          });
          await tx.mouvementStock.create({
            data: {
              produitId: l.produitId, pointDeVenteId: Number(origineId),
              type: "SORTIE", typeSortie: "TRANSFERT_SORTANT", quantite: l.quantite,
              motif: `Transfert ${transfert.reference} → ${transfert.destination.nom} (demande validée)`,
              reference: `${transfert.reference}-OUT-P${l.produitId}`,
              operateurId: parseInt(session.user.id), transfertStockId: transfert.id,
            },
          });
        }

        const t = await tx.transfertStock.update({
          where: { id: transfert.id },
          data: {
            statut: "EN_COURS", origineId: Number(origineId),
            approuveParId: parseInt(session.user.id), dateApprobation: new Date(),
            dateExpedition: new Date(), notes: notes || transfert.notes,
          },
        });

        await auditLog(tx, parseInt(session.user.id), "TRANSFERT_VALIDE", "TransfertStock", t.id, { origineId: Number(origineId) }, getRequestMeta(req));

        await notify(tx, [transfert.creeParId], {
          titre: `Transfert validé : ${transfert.reference}`,
          message: `${session.user.prenom} ${session.user.nom} a validé votre demande de transfert, depuis "${origine.nom}" vers "${transfert.destination.nom}".`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: "/dashboard/user/responsablesPointDeVente",
        });

        return t;
      });

      return NextResponse.json({ data: updated });
    }

    if (action === "REJETER") {
      if (transfert.statut !== "DEMANDE") {
        return NextResponse.json({ error: "Seule une demande peut être rejetée" }, { status: 400 });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const t = await tx.transfertStock.update({
          where: { id: transfert.id },
          data: { statut: "ANNULE", notes: notes ? `${transfert.notes ? transfert.notes + " — " : ""}Rejet : ${notes}` : transfert.notes },
        });
        await auditLog(tx, parseInt(session.user.id), "TRANSFERT_REJETE", "TransfertStock", t.id, { motif: notes ?? null }, getRequestMeta(req));
        await notify(tx, [transfert.creeParId], {
          titre: `Demande de transfert rejetée : ${transfert.reference}`,
          message: `Votre demande de transfert vers "${transfert.destination.nom}" a été rejetée${notes ? ` : ${notes}` : "."}`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: "/dashboard/user/responsablesPointDeVente",
        });
        return t;
      });
      return NextResponse.json({ data: updated });
    }

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
      if (!transfert.origine) {
        return NextResponse.json({ error: "Ce transfert n'a pas encore d'agence source assignée" }, { status: 400 });
      }
      const origineNom = transfert.origine.nom;

      const result = await prisma.$transaction(async (tx) => {
        for (const l of transfert.lignes) {
          await tx.stockSite.upsert({
            where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: transfert.destinationId } },
            // Transit → disponible : incrémenter quantite ET décrémenter quantiteEnTransit (4.3 → 4.1)
            update: { quantite: { increment: l.quantite }, quantiteEnTransit: { decrement: l.quantite } },
            create: { produitId: l.produitId, pointDeVenteId: transfert.destinationId, quantite: l.quantite },
          });
          await tx.mouvementStock.create({
            data: {
              produitId:       l.produitId,
              pointDeVenteId:  transfert.destinationId,
              type:            "ENTREE",
              typeEntree:      "TRANSFERT_ENTRANT",
              quantite:        l.quantite,
              motif:           `Réception transfert ${transfert.reference} depuis ${origineNom}`,
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

        await auditLog(tx, parseInt(session.user.id), "TRANSFERT_RECU", "TransfertStock", t.id, undefined, getRequestMeta(req));
        await comptabiliserTransfertRecu(tx, t.id, parseInt(session.user.id));

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
      if (!transfert.origineId) {
        return NextResponse.json({ error: "Ce transfert n'a pas encore d'agence source assignée" }, { status: 400 });
      }
      const origineId = transfert.origineId;

      const result = await prisma.$transaction(async (tx) => {
        // Restituer le stock à l'origine + libérer le transit à la destination
        for (const l of transfert.lignes) {
          await tx.stockSite.update({
            where: { produitId_pointDeVenteId: { produitId: l.produitId, pointDeVenteId: origineId } },
            data: { quantite: { increment: l.quantite } },
          });
          // Les produits ne viendront plus → libérer le transit destination (4.3)
          await tx.stockSite.updateMany({
            where: { produitId: l.produitId, pointDeVenteId: transfert.destinationId },
            data:  { quantiteEnTransit: { decrement: l.quantite } },
          });
          await tx.mouvementStock.create({
            data: {
              produitId:       l.produitId,
              pointDeVenteId:  origineId,
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

        await auditLog(tx, parseInt(session.user.id), "TRANSFERT_ANNULE", "TransfertStock", t.id, undefined, getRequestMeta(req));
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
