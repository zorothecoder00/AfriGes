import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/agentTerrain/livraisons/[id]/confirmer
 *
 * Confirme qu'une livraison planifiée (PLANIFIEE) a bien été effectuée.
 * Conséquences :
 *  - ReceptionProduitPack.statut PLANIFIEE → LIVREE
 *  - Stock décrémenté par produit
 *  - MouvementStock SORTIE créé par produit
 *  - Renouvellement de cycle pour FAMILIAL et EPARGNE_PRODUIT
 *  - Notification aux admins
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const receptionId = parseInt(id);
    const agentId = parseInt(session.user.id);
    const agentNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    // Résoudre le PDV de l'agent terrain
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: agentId, actif: true },
      select: { pointDeVenteId: true },
    });
    if (!aff?.pointDeVenteId) {
      return NextResponse.json({ error: "Aucun point de vente associé à cet agent" }, { status: 400 });
    }
    const agentPdvId = aff.pointDeVenteId;

    const reception = await prisma.$transaction(async (tx) => {
      const rec = await tx.receptionProduitPack.findUnique({
        where: { id: receptionId },
        include: {
          lignes: true,
          souscription: {
            include: {
              pack: true,
              client: { select: { nom: true, prenom: true, pointDeVenteId: true } },
            },
          },
        },
      });

      if (!rec) throw new Error("Réception introuvable");
      if (rec.statut !== "PLANIFIEE") throw new Error(`Statut invalide : déjà ${rec.statut.toLowerCase()}`);

      // ── Vérification que la livraison appartient au PDV de l'agent ───────────
      const clientPdvId = rec.souscription.client?.pointDeVenteId;
      if (clientPdvId !== agentPdvId) {
        throw new Error("Vous n'êtes pas autorisé à confirmer une livraison pour un autre point de vente");
      }

      const souscription = rec.souscription;
      const souscriptionId = souscription.id;

      // ── Vérification stock PDV ──────────────────────────────────────────────
      for (const ligne of rec.lignes) {
        const stockSite = await tx.stockSite.findUnique({
          where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: agentPdvId } },
          select: { quantite: true },
        });
        const produit = await tx.produit.findUnique({
          where: { id: ligne.produitId },
          select: { nom: true },
        });
        if (!produit) throw new Error(`Produit #${ligne.produitId} introuvable`);
        const stockDispo = stockSite?.quantite ?? 0;
        if (ligne.quantite > stockDispo) {
          throw new Error(
            `Stock insuffisant pour "${produit.nom}" sur ce PDV : ${stockDispo} disponible(s), ${ligne.quantite} demandé(s)`
          );
        }
      }

      // ── Décrémentation stock du PDV + mouvements ────────────────────────────
      for (const ligne of rec.lignes) {
        await tx.stockSite.update({
          where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: agentPdvId } },
          data: { quantite: { decrement: ligne.quantite } },
        });
        await tx.mouvementStock.create({
          data: {
            produitId: ligne.produitId,
            type: "SORTIE",
            quantite: ligne.quantite,
            motif: `Livraison Pack ${souscription.pack.nom} — Souscription #${souscriptionId} (Agent terrain)`,
            reference: `PACK-${souscriptionId}-REC-${rec.id}-AT-${Date.now()}`,
          },
        });
      }

      // ── Statut LIVREE ───────────────────────────────────────────────────────
      const updated = await tx.receptionProduitPack.update({
        where: { id: rec.id },
        data: { statut: "LIVREE", dateLivraison: new Date(), livreurNom: agentNom },
      });

      // ── Notifications ───────────────────────────────────────────────────────
      const clientNom = souscription.client
        ? `${souscription.client.prenom} ${souscription.client.nom}`
        : `souscription #${souscriptionId}`;
      const titre   = `Livraison confirmée — ${souscription.pack.nom}`;
      const message = `L'agent terrain ${agentNom} a confirmé la livraison (réception #${rec.id}) pour ${clientNom}.`;

      await notifyAdmins(tx, { titre, message, priorite: "HAUTE", actionUrl: "/dashboard/admin/ventes" });

      // Notifier le RPV du PDV
      const pdv = await tx.pointDeVente.findUnique({
        where:  { id: agentPdvId },
        select: { rpvId: true },
      });
      if (pdv?.rpvId) {
        await tx.notification.create({
          data: {
            userId:    pdv.rpvId,
            titre,
            message,
            priorite:  "HAUTE",
            actionUrl: "/dashboard/user/responsablesPointDeVente",
          },
        });
      }

      await auditLog(tx, agentId, "LIVRAISON_PACK_CONFIRMEE_AGENT_TERRAIN", "ReceptionProduitPack", rec.id);

      // ── Renouvellement de cycle ─────────────────────────────────────────────
      if (souscription.pack.type === "FAMILIAL") {
        const freq = (souscription.frequenceVersement ?? souscription.pack.frequenceVersement ?? "HEBDOMADAIRE") as string;
        const duree = souscription.pack.dureeJours ?? 30;
        const step = freq === "QUOTIDIEN" ? 1 : freq === "HEBDOMADAIRE" ? 7 : freq === "BIMENSUEL" ? 14 : 30;
        const count = Math.ceil(duree / step);
        const montantTotal = Number(souscription.montantTotal);
        const montantEcheance = Math.round((montantTotal / count) * 100) / 100;
        const debut = new Date();

        await tx.echeancePack.deleteMany({ where: { souscriptionId } });
        await tx.echeancePack.createMany({
          data: Array.from({ length: count }, (_, i) => {
            const date = new Date(debut);
            date.setDate(date.getDate() + (i + 1) * step);
            return {
              souscriptionId,
              numero: i + 1,
              montant:
                i === count - 1
                  ? Math.round((montantTotal - montantEcheance * (count - 1)) * 100) / 100
                  : montantEcheance,
              datePrevue: date,
              statut: "EN_ATTENTE" as const,
            };
          }),
        });

        await tx.souscriptionPack.update({
          where: { id: souscriptionId },
          data: { montantVerse: 0, montantRestant: montantTotal, statut: "ACTIF", dateCloture: null, dateDebut: debut },
        });

        await notifyAdmins(tx, {
          titre: `Nouveau cycle FAMILIAL — ${souscription.pack.nom}`,
          message: `Souscription #${souscriptionId} : cycle ${souscription.numeroCycle} complété, nouveau cycle démarré automatiquement.`,
          priorite: "NORMAL",
          actionUrl: "/dashboard/admin/ventes",
        });
      } else if (souscription.pack.type === "EPARGNE_PRODUIT") {
        await tx.echeancePack.deleteMany({ where: { souscriptionId } });
        await tx.souscriptionPack.update({
          where: { id: souscriptionId },
          data: {
            montantVerse: 0,
            montantRestant: Number(souscription.montantTotal),
            statut: "EN_ATTENTE",
            dateCloture: null,
            dateDebut: new Date(),
          },
        });

        await notifyAdmins(tx, {
          titre: `Nouveau cycle Épargne — ${souscription.pack.nom}`,
          message: `Souscription #${souscriptionId} : produit livré, nouveau cycle d'épargne démarré automatiquement.`,
          priorite: "NORMAL",
          actionUrl: "/dashboard/admin/ventes",
        });
      }

      return updated;
    });

    return NextResponse.json(reception);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    console.error("POST /api/agentTerrain/livraisons/[id]/confirmer", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
