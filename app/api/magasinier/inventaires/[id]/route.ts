import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { getRPVSession } from "@/lib/authRPV";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

async function getSession() {
  return (await getMagasinierSession()) ?? (await getRPVSession());
}

/**
 * GET /api/magasinier/inventaires/[id]
 * Détail d'un inventaire avec ses lignes.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    const inv = await prisma.inventaireSite.findUnique({
      where: { id: Number(id) },
      include: {
        pointDeVente: { select: { id: true, nom: true, code: true, type: true } },
        realisePar:   { select: { id: true, nom: true, prenom: true } },
        validePar:    { select: { id: true, nom: true, prenom: true } },
        lignes: {
          include: {
            produit: { select: { id: true, nom: true, reference: true, unite: true, prixUnitaire: true } },
          },
        },
      },
    });

    if (!inv) return NextResponse.json({ error: "Inventaire introuvable" }, { status: 404 });

    // Stats de l'inventaire
    const nbLignes  = inv.lignes.length;
    const nbEcarts  = inv.lignes.filter(l => l.ecart !== 0).length;
    const valeurEcart = inv.lignes.reduce((acc, l) => acc + l.ecart * Number(l.produit.prixUnitaire), 0);

    return NextResponse.json({ data: { ...inv, stats: { nbLignes, nbEcarts, valeurEcart } } });
  } catch (error) {
    console.error("GET /magasinier/inventaires/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/magasinier/inventaires/[id]
 * Saisir les quantités constatées et/ou valider l'inventaire.
 *
 * - sans action : body.lignes = [{ ligneId, quantiteConstatee }] → mise à jour des écarts
 * - action "VALIDER" : applique les écarts au StockSite + crée les MouvementStock
 * - action "ANNULER" : annule l'inventaire
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    const body = await req.json();
    const { action, lignes, notes } = body;

    const inv = await prisma.inventaireSite.findUnique({
      where: { id: Number(id) },
      include: {
        lignes: { include: { produit: { select: { nom: true } } } },
        pointDeVente: { select: { nom: true } },
      },
    });
    if (!inv) return NextResponse.json({ error: "Inventaire introuvable" }, { status: 404 });
    if (inv.statut !== "EN_COURS" && action !== "ANNULER") {
      return NextResponse.json({ error: "Cet inventaire n'est plus modifiable" }, { status: 400 });
    }

    // ─ Mise à jour des quantités constatées ─────────────────
    if (!action && lignes) {
      const updated = await prisma.$transaction(async (tx) => {
        for (const l of lignes as Array<{ ligneId: number; quantiteConstatee: number }>) {
          const ligne = inv.lignes.find(x => x.id === Number(l.ligneId));
          if (!ligne) continue;
          const ecart = Number(l.quantiteConstatee) - ligne.quantiteSysteme;
          await tx.ligneInventaireSite.update({
            where: { id: Number(l.ligneId) },
            data: { quantiteConstatee: Number(l.quantiteConstatee), ecart },
          });
        }
        return tx.inventaireSite.findUnique({
          where: { id: Number(id) },
          include: { lignes: { include: { produit: { select: { nom: true, prixUnitaire: true } } } } },
        });
      });
      return NextResponse.json({ data: updated });
    }

    // ─ ANNULER ───────────────────────────────────────────────
    if (action === "ANNULER") {
      const updated = await prisma.inventaireSite.update({
        where: { id: Number(id) },
        data: { statut: "ANNULE", notes: notes || inv.notes },
      });
      return NextResponse.json({ data: updated });
    }

    // ─ VALIDER (appliquer les écarts) ────────────────────────
    if (action === "VALIDER") {
      const result = await prisma.$transaction(async (tx) => {
        for (const ligne of inv.lignes) {
          if (ligne.ecart === 0) continue;

          // Mettre à jour le StockSite avec la quantité constatée
          await tx.stockSite.upsert({
            where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: inv.pointDeVenteId } },
            update: { quantite: ligne.quantiteConstatee },
            create: { produitId: ligne.produitId, pointDeVenteId: inv.pointDeVenteId, quantite: ligne.quantiteConstatee },
          });

          // MouvementStock d'ajustement
          await tx.mouvementStock.create({
            data: {
              produitId:      ligne.produitId,
              pointDeVenteId: inv.pointDeVenteId,
              type:           "AJUSTEMENT",
              typeEntree:     ligne.ecart > 0 ? "AJUSTEMENT_POSITIF"  : undefined,
              typeSortie:     ligne.ecart < 0 ? "AJUSTEMENT_NEGATIF"  : undefined,
              quantite:       Math.abs(ligne.ecart),
              motif:          `Ajustement inventaire ${inv.reference}`,
              reference:      `${inv.reference}-ADJ-P${ligne.produitId}-${randomUUID().slice(0,4).toUpperCase()}`,
              operateurId:    parseInt(session.user.id),
            },
          });
        }

        const i = await tx.inventaireSite.update({
          where: { id: Number(id) },
          data: {
            statut:     "VALIDE",
            valideParId:parseInt(session.user.id),
            notes:      notes || inv.notes,
          },
        });

        await auditLog(tx, parseInt(session.user.id), "INVENTAIRE_VALIDE", "InventaireSite", i.id);

        await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "COMPTABLE"], {
          titre:    `Inventaire validé : ${inv.reference}`,
          message:  `${session.user.prenom} ${session.user.nom} a validé l'inventaire de "${inv.pointDeVente.nom}". Écarts appliqués au stock.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl:`/dashboard/magasinier/inventaires/${id}`,
        });

        return i;
      });
      return NextResponse.json({ data: result });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /magasinier/inventaires/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
