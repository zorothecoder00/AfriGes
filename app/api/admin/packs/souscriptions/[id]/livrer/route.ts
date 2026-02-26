import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET  — Détail d'une souscription (versements + échéances + réceptions).
 * POST — Planifie ou valide la livraison des produits pour une souscription.
 *   action: "planifier" → crée ReceptionProduitPack PLANIFIEE
 *   action: "livrer"    → marque une réception comme LIVREE + décrémente stock
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const souscription = await prisma.souscriptionPack.findUnique({
      where: { id: parseInt(id) },
      include: {
        pack: true,
        user: { select: { id: true, nom: true, prenom: true, telephone: true } },
        client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        versements: { orderBy: { datePaiement: "desc" } },
        echeances: { orderBy: { numero: "asc" } },
        receptions: {
          include: {
            lignes: {
              include: { produit: { select: { nom: true, prixUnitaire: true } } },
            },
          },
        },
      },
    });

    if (!souscription) {
      return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    }

    return NextResponse.json(souscription);
  } catch (error) {
    console.error("GET /api/admin/packs/souscriptions/[id]/livrer", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

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

    const adminNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    if (action === "planifier") {
      if (!lignes || lignes.length === 0) {
        return NextResponse.json({ error: "Au moins une ligne requise" }, { status: 400 });
      }

      // ── 1. Éligibilité par type de pack ───────────────────────────────────
      const isF2 =
        souscription.pack.type === "REVENDEUR" &&
        souscription.formuleRevendeur === "FORMULE_2";

      const statutsEligibles: string[] =
        souscription.pack.type === "URGENCE" ||
        (souscription.pack.type === "REVENDEUR" && !isF2)
          ? ["ACTIF", "COMPLETE"]
          : isF2
          ? ["EN_ATTENTE", "ACTIF", "COMPLETE"]
          : ["COMPLETE"]; // ALIMENTAIRE, FAMILIAL, EPARGNE_PRODUIT, FIDELITE

      if (!statutsEligibles.includes(souscription.statut)) {
        const typeLabel: Record<string, string> = {
          ALIMENTAIRE: "Alimentaire", REVENDEUR: "Revendeur", FAMILIAL: "Familial",
          URGENCE: "Urgence", EPARGNE_PRODUIT: "Épargne-Produit", FIDELITE: "Fidélité",
        };
        const condMsg =
          souscription.pack.type === "URGENCE"
            ? "la souscription doit être active (acompte versé)"
            : souscription.pack.type === "REVENDEUR" && !isF2
            ? "la souscription doit être active (50 % upfront versé)"
            : isF2
            ? "statut invalide"
            : "la souscription doit être entièrement soldée (COMPLETE)";
        return NextResponse.json(
          {
            error: `Livraison impossible (Pack ${typeLabel[souscription.pack.type] ?? souscription.pack.type}) : ${condMsg}. Statut actuel : ${souscription.statut}`,
          },
          { status: 400 }
        );
      }

      // ── 2. Montant total de la livraison ≤ montant du pack ───────────────
      const montantPack = Number(souscription.montantTotal);
      const montantNouvellesLignes = (lignes as { quantite: number; prixUnitaire: number }[]).reduce(
        (sum, l) => sum + l.quantite * l.prixUnitaire,
        0
      );

      // Inclure les réceptions déjà PLANIFIEE pour éviter le double-booking
      const receptionsEnAttente = await prisma.receptionProduitPack.findMany({
        where: { souscriptionId, statut: "PLANIFIEE" },
        include: { lignes: { select: { quantite: true, prixUnitaire: true } } },
      });
      const montantDejaPlanifie = receptionsEnAttente.reduce(
        (sum, rec) =>
          sum + rec.lignes.reduce((s, l) => s + l.quantite * Number(l.prixUnitaire), 0),
        0
      );

      if (montantNouvellesLignes + montantDejaPlanifie > montantPack) {
        const fmt = (n: number) =>
          new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " FCFA";
        const detail =
          montantDejaPlanifie > 0
            ? `nouvelle livraison (${fmt(montantNouvellesLignes)}) + déjà planifié (${fmt(montantDejaPlanifie)}) = ${fmt(montantNouvellesLignes + montantDejaPlanifie)}`
            : fmt(montantNouvellesLignes);
        return NextResponse.json(
          { error: `Montant excédé : ${detail} > budget pack (${fmt(montantPack)})` },
          { status: 400 }
        );
      }

      // ── Valider le stock disponible avant de planifier ────────────────────
      for (const ligne of lignes as { produitId: number; quantite: number; prixUnitaire: number }[]) {
        const produit = await prisma.produit.findUnique({
          where: { id: ligne.produitId },
          select: { nom: true, stock: true },
        });
        if (!produit) {
          return NextResponse.json({ error: `Produit #${ligne.produitId} introuvable` }, { status: 404 });
        }
        if (ligne.quantite > produit.stock) {
          return NextResponse.json(
            { error: `Stock insuffisant pour "${produit.nom}" : ${produit.stock} disponible(s), ${ligne.quantite} demandé(s)` },
            { status: 400 }
          );
        }
      }

      const reception = await prisma.$transaction(async (tx) => {
        const rec = await tx.receptionProduitPack.create({
          data: {
            souscriptionId,
            statut: "PLANIFIEE",
            datePrevisionnelle: datePrevisionnelle ? new Date(datePrevisionnelle) : new Date(),
            livreurNom: livreurNom ?? null,
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
          message: `${adminNom} a planifié une livraison pour la souscription #${souscriptionId}${livreurNom ? ` (livreur : ${livreurNom})` : ""}.`,
          priorite: "NORMAL",
          actionUrl: "/dashboard/admin/packs",
        });

        await auditLog(tx, parseInt(session.user.id), "LIVRAISON_PACK_PLANIFIEE", "ReceptionProduitPack", rec.id);

        return rec;
      });

      return NextResponse.json(reception, { status: 201 });
    }

    if (action === "livrer") {
      if (!receptionId) {
        return NextResponse.json({ error: "receptionId requis" }, { status: 400 });
      }

      const reception = await prisma.$transaction(async (tx) => {
        const rec = await tx.receptionProduitPack.findUnique({
          where: { id: parseInt(receptionId) },
          include: { lignes: true },
        });

        if (!rec || rec.souscriptionId !== souscriptionId) throw new Error("Réception introuvable");
        if (rec.statut !== "PLANIFIEE") throw new Error(`Déjà ${rec.statut.toLowerCase()}`);

        // Vérifier le stock au moment réel de la livraison
        for (const ligne of rec.lignes) {
          const produit = await tx.produit.findUnique({
            where: { id: ligne.produitId },
            select: { nom: true, stock: true },
          });
          if (!produit) throw new Error(`Produit #${ligne.produitId} introuvable`);
          if (ligne.quantite > produit.stock) {
            throw new Error(
              `Stock insuffisant pour "${produit.nom}" : ${produit.stock} disponible(s), ${ligne.quantite} demandé(s)`
            );
          }
        }

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
              motif: `Livraison Pack ${souscription.pack.nom} — Souscription #${souscriptionId}`,
              reference: `PACK-${souscriptionId}-REC-${rec.id}-${Date.now()}`,
            },
          });
        }

        const updated = await tx.receptionProduitPack.update({
          where: { id: rec.id },
          data: { statut: "LIVREE", dateLivraison: new Date(), ...(livreurNom ? { livreurNom } : {}) },
        });

        await notifyAdmins(tx, {
          titre: `Produits livrés — ${souscription.pack.nom}`,
          message: `La livraison pour la souscription #${souscriptionId} a été validée par ${adminNom}.`,
          priorite: "HAUTE",
          actionUrl: "/dashboard/admin/packs",
        });

        await auditLog(tx, parseInt(session.user.id), "LIVRAISON_PACK_LIVREE", "ReceptionProduitPack", updated.id);

        // ── Renouvellement de cycle ────────────────────────────────────────
        // FAMILIAL : nouveau cycle après chaque livraison (pour accumuler
        //            les cycles et déclencher le bonus)
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
            actionUrl: "/dashboard/admin/packs",
          });
        }

        // ÉPARGNE-PRODUIT : cycle renouvelable automatiquement après livraison
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
            actionUrl: "/dashboard/admin/packs",
          });
        }

        return updated;
      });

      return NextResponse.json(reception);
    }

    if (action === "vente_directe") {
      if (!lignes || lignes.length === 0) {
        return NextResponse.json({ error: "Au moins une ligne requise" }, { status: 400 });
      }

      // Bug #6: Valider le statut selon le type de pack
      // URGENCE : livraison après acompte → ACTIF requis
      // REVENDEUR F1 : livraison après 50% upfront → ACTIF requis
      // REVENDEUR F2 : crédit total → livraison immédiate, EN_ATTENTE/ACTIF autorisés
      // Autres : uniquement COMPLETE (soldé)
      const isF2 =
        souscription.pack.type === "REVENDEUR" &&
        souscription.formuleRevendeur === "FORMULE_2";

      const statutsValides =
        souscription.pack.type === "URGENCE" ||
        (souscription.pack.type === "REVENDEUR" && !isF2)
          ? ["ACTIF", "COMPLETE"]
          : isF2
          ? ["EN_ATTENTE", "ACTIF", "COMPLETE"]
          : ["COMPLETE"];

      if (!statutsValides.includes(souscription.statut)) {
        return NextResponse.json(
          {
            error: isF2
              ? `Vente directe impossible : statut invalide (${souscription.statut})`
              : souscription.pack.type === "REVENDEUR" || souscription.pack.type === "URGENCE"
              ? `Vente directe impossible : la souscription doit être active ou complète (statut actuel : ${souscription.statut})`
              : `Vente directe impossible : la souscription doit être entièrement soldée (statut actuel : ${souscription.statut})`,
          },
          { status: 400 }
        );
      }

      // Valider le stock avant toute écriture
      for (const ligne of lignes as { produitId: number; quantite: number; prixUnitaire: number }[]) {
        const produit = await prisma.produit.findUnique({
          where: { id: ligne.produitId },
          select: { nom: true, stock: true },
        });
        if (!produit) {
          return NextResponse.json({ error: `Produit #${ligne.produitId} introuvable` }, { status: 404 });
        }
        if (ligne.quantite > produit.stock) {
          return NextResponse.json(
            { error: `Stock insuffisant pour "${produit.nom}" : ${produit.stock} disponible(s), ${ligne.quantite} demandé(s)` },
            { status: 400 }
          );
        }
      }

      const reception = await prisma.$transaction(async (tx) => {
        const rec = await tx.receptionProduitPack.create({
          data: {
            souscriptionId,
            statut: "LIVREE",
            datePrevisionnelle: new Date(),
            dateLivraison: new Date(),
            livreurNom: livreurNom ?? null,
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

        for (const ligne of lignes as { produitId: number; quantite: number; prixUnitaire: number }[]) {
          await tx.produit.update({
            where: { id: ligne.produitId },
            data: { stock: { decrement: ligne.quantite } },
          });
          await tx.mouvementStock.create({
            data: {
              produitId: ligne.produitId,
              type: "SORTIE",
              quantite: ligne.quantite,
              motif: `Vente directe Pack ${souscription.pack.nom} — Souscription #${souscriptionId}`,
              reference: `PACK-VD-${souscriptionId}-${Date.now()}`,
            },
          });
        }

        await notifyAdmins(tx, {
          titre: `Vente directe — ${souscription.pack.nom}`,
          message: `${adminNom} a enregistré une vente directe pour la souscription #${souscriptionId}.`,
          priorite: "NORMAL",
          actionUrl: "/dashboard/admin/ventes",
        });

        await auditLog(tx, parseInt(session.user.id), "LIVRAISON_PACK_VENTE_DIRECTE", "ReceptionProduitPack", rec.id);

        return rec;
      });

      return NextResponse.json(reception, { status: 201 });
    }

    return NextResponse.json({ error: "action invalide : 'planifier', 'livrer' ou 'vente_directe'" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    console.error("POST /api/admin/packs/souscriptions/[id]/livrer", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
