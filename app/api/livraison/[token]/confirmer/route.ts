import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog, notify, notifyRoles } from "@/lib/notifications";

type Ctx = { params: Promise<{ token: string }> };

interface LigneConfirmation { produitId: number; quantiteLivree: number }

/**
 * POST /api/livraison/[token]/confirmer
 * Accès SANS login — attestation de réception par le client (CDC §3.5). Vaut
 * signature électronique officielle. Clôture la commande si conforme sans écart,
 * sinon ouvre un litige et notifie l'agent terrain / le service commercial.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { token } = await params;
    const br = await prisma.bonReception.findUnique({
      where: { tokenConfirmation: token },
      include: { lignes: true, commandeClient: { select: { id: true, reference: true, agentId: true } } },
    });
    if (!br) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });
    if (br.statut !== "EN_ATTENTE_SIGNATURE") {
      return NextResponse.json({ error: "Cette livraison a déjà été confirmée" }, { status: 409 });
    }

    const body = await req.json();
    const signatureClientNom = String(body.signatureClientNom || "").trim();
    if (!signatureClientNom) return NextResponse.json({ error: "Signature (nom) obligatoire" }, { status: 400 });

    const etatMarchandise = body.etatMarchandise === "NON_CONFORME" ? "NON_CONFORME" : "CONFORME";
    const lignesInput = (body.lignes ?? []) as LigneConfirmation[];
    const lignesById = new Map(br.lignes.map((l) => [l.produitId, l]));

    let ecartConstate = false;
    const updates: { id: number; quantiteLivree: number }[] = [];
    for (const li of lignesInput) {
      const existante = lignesById.get(Number(li.produitId));
      if (!existante) continue;
      const qte = Number(li.quantiteLivree);
      if (!Number.isFinite(qte) || qte < 0 || qte > existante.quantiteCommandee) {
        return NextResponse.json({ error: `Quantité livrée invalide pour un produit (0 à ${existante.quantiteCommandee})` }, { status: 400 });
      }
      if (qte !== existante.quantiteCommandee) ecartConstate = true;
      updates.push({ id: existante.id, quantiteLivree: qte });
    }

    const reserve = String(body.reserve || "").trim() || null;
    if ((etatMarchandise === "NON_CONFORME" || ecartConstate) && !reserve) {
      return NextResponse.json({ error: "Réserve/observations obligatoires (non conforme ou écart de quantité)" }, { status: 400 });
    }

    const litige = etatMarchandise === "NON_CONFORME" || ecartConstate;
    const statut = litige ? "LITIGE" : "SIGNE";

    const updated = await prisma.$transaction(async (tx) => {
      for (const u of updates) {
        await tx.ligneBonReception.update({ where: { id: u.id }, data: { quantiteLivree: u.quantiteLivree } });
      }
      const b = await tx.bonReception.update({
        where: { id: br.id },
        data: {
          statut, etatMarchandise, reserve, ecartConstate,
          signatureClientNom, dateSignatureClient: new Date(),
          signatureClientPieceIdentite: body.signatureClientPieceIdentite || null,
          dateSignatureLivreur: br.dateSignatureLivreur ?? new Date(),
          latitudeLivraison: typeof body.latitude === "number" ? body.latitude : null,
          longitudeLivraison: typeof body.longitude === "number" ? body.longitude : null,
        },
        include: { lignes: { include: { produit: { select: { nom: true } } } } },
      });
      // Pas d'utilisateur authentifié (confirmation publique par le client) —
      // l'action est rattachée au livreur/agent pour respecter la FK AuditLog.userId.
      await auditLog(tx, br.livreurId ?? br.commandeClient.agentId, litige ? "BR_LITIGE" : "BR_SIGNE", "BonReception", br.id, { ecartConstate, etatMarchandise, confirmationPublique: true });

      if (litige) {
        await notifyRoles(tx, ["COMMERCIAL", "MAGAZINIER"], {
          titre: `Réserve sur livraison — commande ${br.commandeClient.reference}`,
          message: `Le client a signalé une livraison ${etatMarchandise === "NON_CONFORME" ? "non conforme" : "avec écart"} : ${reserve}`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/user/agentsTerrain/commandes-client?detail=${br.commandeClient.id}`,
        });
        await notify(tx, [br.commandeClient.agentId], {
          titre: `Réserve sur la livraison de ${br.commandeClient.reference}`,
          message: `Le client a émis une réserve : ${reserve}`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/user/agentsTerrain/commandes-client?detail=${br.commandeClient.id}`,
        });
      } else {
        await tx.commandeClient.update({ where: { id: br.commandeClient.id }, data: { statut: "CLOTUREE" } });
        await notify(tx, [br.commandeClient.agentId], {
          titre: `Commande ${br.commandeClient.reference} clôturée`,
          message: `Le client a confirmé la réception sans réserve.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/agentsTerrain/commandes-client?detail=${br.commandeClient.id}`,
        });
      }
      return b;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("POST /livraison/[token]/confirmer:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
