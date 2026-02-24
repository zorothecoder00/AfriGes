import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { notifyAdmins } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — Planifie ou valide la livraison du produit pour une souscription.
 * Body: { action: "planifier" | "livrer", lignes: [{produitId, quantite, prixUnitaire}], datePrevisionnelle?, livreurNom?, notes? }
 *
 * - "planifier" : crée une ReceptionProduitPack PLANIFIEE avec les lignes
 * - "livrer"    : marque une réception existante (receptionId) comme LIVREE et
 *                 décrémente le stock des produits
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const souscriptionId = parseInt(id);
    const body = await req.json();
    const { action, lignes, datePrevisionnelle, livreurNom, notes, receptionId } = body;

    const souscription = await prisma.souscriptionPack.findUnique({
      where: { id: souscriptionId },
      include: { pack: true },
    });

    if (!souscription) {
      return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    }

    const rpvNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    if (action === "planifier") {
      if (!lignes || lignes.length === 0) {
        return NextResponse.json({ error: "Au moins une ligne de produit requise" }, { status: 400 });
      }

      const reception = await prisma.$transaction(async (tx) => {
        const rec = await tx.receptionProduitPack.create({
          data: {
            souscriptionId,
            statut: "PLANIFIEE",
            datePrevisionnelle: datePrevisionnelle ? new Date(datePrevisionnelle) : new Date(),
            livreurNom: livreurNom ?? rpvNom,
            notes,
            lignes: {
              create: lignes.map((l: { produitId: number; quantite: number; prixUnitaire: number }) => ({
                produitId: l.produitId,
                quantite: l.quantite,
                prixUnitaire: l.prixUnitaire,
              })),
            },
          },
          include: { lignes: { include: { produit: { select: { nom: true } } } } },
        });

        await notifyAdmins(tx, {
          titre: `Livraison planifiée — ${souscription.pack.nom}`,
          message: `Une livraison de produits pour la souscription #${souscriptionId} a été planifiée par ${rpvNom}.`,
          priorite: "NORMAL",
          actionUrl: "/dashboard/user/packs",
        });

        return rec;
      });

      return NextResponse.json(reception, { status: 201 });
    }

    if (action === "livrer") {
      if (!receptionId) {
        return NextResponse.json({ error: "receptionId requis pour l'action 'livrer'" }, { status: 400 });
      }

      const reception = await prisma.$transaction(async (tx) => {
        const rec = await tx.receptionProduitPack.findUnique({
          where: { id: parseInt(receptionId) },
          include: { lignes: true },
        });

        if (!rec || rec.souscriptionId !== souscriptionId) {
          throw new Error("Réception introuvable");
        }
        if (rec.statut !== "PLANIFIEE") {
          throw new Error(`Réception déjà ${rec.statut.toLowerCase()}`);
        }

        // Décrémenter le stock pour chaque ligne
        for (const ligne of rec.lignes) {
          await tx.produit.update({
            where: { id: ligne.produitId },
            data: { stock: { decrement: ligne.quantite } },
          });
          await tx.mouvementStock.create({
            data: {
              produitId: ligne.produitId,
              type: "SORTIE",
              quantite: ligne.quantite,
              motif: `Livraison Pack #${souscriptionId} — ${souscription.pack.nom}`,
              reference: `PACK-${souscriptionId}-REC-${rec.id}-${Date.now()}`,
            },
          });
        }

        const updated = await tx.receptionProduitPack.update({
          where: { id: rec.id },
          data: { statut: "LIVREE", dateLivraison: new Date(), livreurNom: livreurNom ?? rpvNom },
        });

        await notifyAdmins(tx, {
          titre: `Produits livrés — ${souscription.pack.nom}`,
          message: `La livraison pour la souscription #${souscriptionId} a été validée par ${rpvNom}.`,
          priorite: "HAUTE",
          actionUrl: "/dashboard/user/packs",
        });

        // ── Renouvellement de cycle ────────────────────────────────────────
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
                montant: i === count - 1
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
            actionUrl: "/dashboard/user/packs",
          });
        }

        else if (souscription.pack.type === "EPARGNE_PRODUIT") {
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
            actionUrl: "/dashboard/user/packs",
          });
        }

        return updated;
      });

      return NextResponse.json(reception);
    }

    return NextResponse.json({ error: "Action invalide : 'planifier' ou 'livrer'" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/rpv/packs/[id]/livrer", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
