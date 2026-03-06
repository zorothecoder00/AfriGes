import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/logistique/livraisons-packs/[id]/confirmer
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
    const session = await getLogistiqueSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const receptionId = parseInt(id);
    const agentNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const reception = await prisma.$transaction(async (tx) => {
      const rec = await tx.receptionProduitPack.findUnique({
        where: { id: receptionId },
        include: {
          lignes: true,
          souscription: { include: { pack: true } },
        },
      });

      if (!rec) throw new Error("Réception introuvable");
      if (rec.statut !== "PLANIFIEE") throw new Error(`Statut invalide : déjà ${rec.statut.toLowerCase()}`);

      const souscription = rec.souscription;
      const souscriptionId = souscription.id;

      // ── Vérification stock ──────────────────────────────────────────────────
      for (const ligne of rec.lignes) {
        const produit = await tx.produit.findUnique({
          where: { id: ligne.produitId },
          select: { nom: true, stocks: { select: { quantite: true } } },
        });
        if (!produit) throw new Error(`Produit #${ligne.produitId} introuvable`);
        const totalStock = produit.stocks.reduce((s, ss) => s + ss.quantite, 0);
        if (ligne.quantite > totalStock) {
          throw new Error(
            `Stock insuffisant pour "${produit.nom}" : ${totalStock} disponible(s), ${ligne.quantite} demandé(s)`
          );
        }
      }

      // ── Décrémentation stock (greedy par site) + mouvements ─────────────────
      for (const ligne of rec.lignes) {
        const sites = await tx.stockSite.findMany({
          where: { produitId: ligne.produitId, quantite: { gt: 0 } },
          orderBy: { quantite: "desc" },
        });
        let remaining = ligne.quantite;
        for (const site of sites) {
          if (remaining <= 0) break;
          const dec = Math.min(site.quantite, remaining);
          await tx.stockSite.update({ where: { id: site.id }, data: { quantite: { decrement: dec } } });
          remaining -= dec;
        }
        await tx.mouvementStock.create({
          data: {
            produitId: ligne.produitId,
            type: "SORTIE",
            quantite: ligne.quantite,
            motif: `Livraison Pack ${souscription.pack.nom} — Souscription #${souscriptionId} (Logistique)`,
            reference: `PACK-${souscriptionId}-REC-${rec.id}-LOG-${Date.now()}`,
          },
        });
      }

      // ── Statut LIVREE ───────────────────────────────────────────────────────
      const updated = await tx.receptionProduitPack.update({
        where: { id: rec.id },
        data: { statut: "LIVREE", dateLivraison: new Date() },
      });

      // ── Notification admins ─────────────────────────────────────────────────
      await notifyAdmins(tx, {
        titre: `Livraison confirmée — ${souscription.pack.nom}`,
        message: `Le logisticien ${agentNom} a confirmé la livraison (réception #${rec.id}) pour la souscription #${souscriptionId}.`,
        priorite: "HAUTE",
        actionUrl: "/dashboard/admin/ventes",
      });

      await auditLog(tx, parseInt(session.user.id), "LIVRAISON_PACK_CONFIRMEE_LOGISTIQUE", "ReceptionProduitPack", rec.id);

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
    console.error("POST /api/logistique/livraisons-packs/[id]/confirmer", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
