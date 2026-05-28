import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { notifyAdmins, notify, auditLog } from "@/lib/notifications";
import { PrioriteNotification } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET  — Détail d'une souscription (versements + échéances + réceptions).
 * POST — Planifie la livraison des produits pour une souscription.
 *   action: "planifier"    → crée ReceptionProduitPack PLANIFIEE (magasinier du PDV notifié + RPV notifié)
 *   action: "vente_directe"→ livraison immédiate sans étape magasinier (LIVREE + stock décrémenté)
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
    const { action, lignes, datePrevisionnelle, livreurNom, notes, receptionId, pointDeVenteId } = body;

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

      // ── PDV cible obligatoire ─────────────────────────────────────────────
      if (!pointDeVenteId) {
        return NextResponse.json(
          { error: "Veuillez choisir le point de vente du client pour cette livraison." },
          { status: 400 }
        );
      }

      // Vérifier que le PDV existe
      const pdv = await prisma.pointDeVente.findUnique({
        where: { id: pointDeVenteId },
        select: { id: true, nom: true, rpvId: true },
      });
      if (!pdv) {
        return NextResponse.json({ error: "Point de vente introuvable" }, { status: 404 });
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

      // ── 3. Valider le stock disponible sur le PDV cible (quantite - quantiteReservee) ──
      for (const ligne of lignes as { produitId: number; quantite: number; prixUnitaire: number }[]) {
        const stockSite = await prisma.stockSite.findFirst({
          where: { produitId: ligne.produitId, pointDeVenteId },
          select: { quantite: true, quantiteReservee: true },
        });
        const produit = await prisma.produit.findUnique({
          where: { id: ligne.produitId },
          select: { nom: true },
        });
        if (!produit) {
          return NextResponse.json({ error: `Produit #${ligne.produitId} introuvable` }, { status: 404 });
        }
        const dispo = (stockSite?.quantite ?? 0) - (stockSite?.quantiteReservee ?? 0);
        if (ligne.quantite > dispo) {
          return NextResponse.json(
            { error: `Stock insuffisant pour "${produit.nom}" sur le PDV "${pdv.nom}" : ${dispo} disponible(s), ${ligne.quantite} demandé(s)` },
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
            pointDeVenteId,
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

        // Notifier les magasiniers affectés au PDV cible
        const magasiniers = await tx.user.findMany({
          where: {
            gestionnaire: { role: "MAGAZINIER", actif: true },
            affectationsPDV: { some: { pointDeVenteId, actif: true } },
          },
          select: { id: true },
        });
        const magasinierIds = magasiniers.map((u) => u.id);

        if (magasinierIds.length > 0) {
          await notify(tx, magasinierIds, {
            titre: `Sortie stock à préparer — ${souscription.pack.nom}`,
            message: `${adminNom} a planifié une livraison (souscription #${souscriptionId}) sur le PDV "${pdv.nom}". Confirmez la sortie des produits.`,
            priorite: PrioriteNotification.HAUTE,
            actionUrl: "/dashboard/user/magasiniers",
          });
        }

        // Notifier le RPV du PDV cible
        if (pdv.rpvId) {
          await notify(tx, [pdv.rpvId], {
            titre: `Livraison planifiée — ${souscription.pack.nom}`,
            message: `${adminNom} a planifié une livraison pour la souscription #${souscriptionId} sur votre PDV "${pdv.nom}". En attente de confirmation par le magasinier.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: "/dashboard/user/responsablesPointsDeVente",
          });
        }

        await notifyAdmins(tx, {
          titre: `Livraison planifiée — ${souscription.pack.nom}`,
          message: `${adminNom} a planifié une livraison pour la souscription #${souscriptionId} (PDV : ${pdv.nom})${livreurNom ? ` — livreur : ${livreurNom}` : ""}.`,
          priorite: "NORMAL",
          actionUrl: "/dashboard/admin/packs",
        });

        await auditLog(tx, parseInt(session.user.id), "LIVRAISON_PACK_PLANIFIEE", "ReceptionProduitPack", rec.id);

        return rec;
      });

      return NextResponse.json(reception, { status: 201 });
    }

    if (action === "vente_directe") {
      if (!lignes || lignes.length === 0) {
        return NextResponse.json({ error: "Au moins une ligne requise" }, { status: 400 });
      }

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

      // Valider le stock avant toute écriture (quantite - quantiteReservee)
      for (const ligne of lignes as { produitId: number; quantite: number; prixUnitaire: number }[]) {
        const produit = await prisma.produit.findUnique({
          where: { id: ligne.produitId },
          select: { nom: true, stocks: { select: { quantite: true, quantiteReservee: true } } },
        });
        if (!produit) {
          return NextResponse.json({ error: `Produit #${ligne.produitId} introuvable` }, { status: 404 });
        }
        const totalDispo = produit.stocks.reduce((s, ss) => s + (ss.quantite - ss.quantiteReservee), 0);
        if (ligne.quantite > totalDispo) {
          return NextResponse.json(
            { error: `Stock insuffisant pour "${produit.nom}" : ${totalDispo} disponible(s), ${ligne.quantite} demandé(s)` },
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
            ...(pointDeVenteId ? { pointDeVenteId } : {}),
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
          const sites = await tx.stockSite.findMany({
            where: { produitId: ligne.produitId },
            orderBy: { quantite: "desc" },
          });
          let remaining = ligne.quantite;
          for (const site of sites) {
            if (remaining <= 0) break;
            const dispo = site.quantite - site.quantiteReservee;
            if (dispo <= 0) continue;
            const dec = Math.min(dispo, remaining);
            await tx.stockSite.update({ where: { id: site.id }, data: { quantite: { decrement: dec } } });
            remaining -= dec;
          }
          await tx.mouvementStock.create({
            data: {
              produitId:    ligne.produitId,
              type:         "SORTIE",
              typeSortie:   "LIVRAISON_CLIENT",
              quantite:     ligne.quantite,
              prixUnitaire: ligne.prixUnitaire, // prix de vente au client
              motif:        `Vente directe Pack ${souscription.pack.nom} — Souscription #${souscriptionId}`,
              reference:    `PACK-VD-${souscriptionId}-${Date.now()}`,
              souscriptionId,
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

    return NextResponse.json({ error: "action invalide : 'planifier' ou 'vente_directe'" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    console.error("POST /api/admin/packs/souscriptions/[id]/livrer", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
