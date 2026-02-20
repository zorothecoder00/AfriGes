import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { randomUUID } from "crypto";

type Ctx = { params: { id: string } };

/** GET /api/rpv/livraisons/[id] — Détail complet d'une livraison */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const livraison = await prisma.livraison.findUnique({
      where:   { id: Number(params.id) },
      include: { lignes: { include: { produit: { select: { id: true, nom: true, stock: true, prixUnitaire: true } } } } },
    });
    if (!livraison) return NextResponse.json({ message: "Livraison introuvable" }, { status: 404 });

    return NextResponse.json({
      success: true,
      data: {
        ...livraison,
        datePrevisionnelle: livraison.datePrevisionnelle.toISOString(),
        dateLivraison:      livraison.dateLivraison?.toISOString() ?? null,
        createdAt:          livraison.createdAt.toISOString(),
        updatedAt:          livraison.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/rpv/livraisons/[id] error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/rpv/livraisons/[id]
 *
 * Gère toutes les transitions de statut :
 *  - { action: "demarrer" }          EN_ATTENTE → EN_COURS
 *  - { action: "annuler" }           EN_ATTENTE|EN_COURS → ANNULEE
 *  - { action: "valider", lignes: [{ ligneId, quantiteRecue }] }
 *      EN_COURS → LIVREE + crée les MouvementStock
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const id = Number(params.id);
    const livraison = await prisma.livraison.findUnique({
      where:   { id },
      include: { lignes: { include: { produit: true } } },
    });
    if (!livraison) return NextResponse.json({ message: "Livraison introuvable" }, { status: 404 });

    const body   = await req.json();
    const action = body.action as "demarrer" | "annuler" | "valider";

    // ── Démarrer ──────────────────────────────────────────────────────────
    if (action === "demarrer") {
      if (livraison.statut !== "EN_ATTENTE")
        return NextResponse.json({ message: "Seule une livraison EN_ATTENTE peut être démarrée" }, { status: 400 });

      const updated = await prisma.livraison.update({
        where: { id },
        data:  { statut: "EN_COURS" },
      });
      return NextResponse.json({ success: true, message: "Livraison démarrée", data: { ...updated, datePrevisionnelle: updated.datePrevisionnelle.toISOString() } });
    }

    // ── Annuler ───────────────────────────────────────────────────────────
    if (action === "annuler") {
      if (!["EN_ATTENTE", "EN_COURS"].includes(livraison.statut))
        return NextResponse.json({ message: "Cette livraison ne peut pas être annulée" }, { status: 400 });

      const updated = await prisma.livraison.update({
        where: { id },
        data:  { statut: "ANNULEE" },
      });
      return NextResponse.json({ success: true, message: "Livraison annulée", data: { ...updated, datePrevisionnelle: updated.datePrevisionnelle.toISOString() } });
    }

    // ── Valider (réception ou expédition) ─────────────────────────────────
    if (action === "valider") {
      if (livraison.statut !== "EN_COURS")
        return NextResponse.json({ message: "Seule une livraison EN_COURS peut être validée" }, { status: 400 });

      const lignesRecues: { ligneId: number; quantiteRecue: number }[] = body.lignes ?? [];
      if (!lignesRecues.length) {
        // Accepter avec quantitePrevue si lignes non fournies
        for (const l of livraison.lignes) {
          lignesRecues.push({ ligneId: l.id, quantiteRecue: l.quantitePrevue });
        }
      }

      // Vérifier stock pour EXPEDITION
      if (livraison.type === "EXPEDITION") {
        for (const lr of lignesRecues) {
          const l = livraison.lignes.find((x) => x.id === lr.ligneId);
          if (!l) continue;
          if (l.produit.stock < lr.quantiteRecue)
            return NextResponse.json(
              { message: `Stock insuffisant pour "${l.produit.nom}" (disponible: ${l.produit.stock})` },
              { status: 400 }
            );
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        // Mettre à jour chaque ligne + créer les mouvements de stock
        for (const lr of lignesRecues) {
          const ligne = livraison.lignes.find((x) => x.id === lr.ligneId);
          if (!ligne) continue;

          await tx.livraisonLigne.update({
            where: { id: lr.ligneId },
            data:  { quantiteRecue: lr.quantiteRecue },
          });

          const typeMvt = livraison.type === "RECEPTION" ? "ENTREE" : "SORTIE";
          const delta   = livraison.type === "RECEPTION" ? lr.quantiteRecue : -lr.quantiteRecue;

          await tx.mouvementStock.create({
            data: {
              produitId:  ligne.produitId,
              type:       typeMvt,
              quantite:   lr.quantiteRecue,
              motif:      `${livraison.type === "RECEPTION" ? "Réception" : "Expédition"} livraison ${livraison.reference}`,
              reference:  `RPV-LIV-${randomUUID()}`,
            },
          });

          await tx.produit.update({
            where: { id: ligne.produitId },
            data:  { stock: { increment: delta }, prixUnitaire: new Prisma.Decimal(Number(ligne.produit.prixUnitaire)) },
          });
        }

        return tx.livraison.update({
          where: { id },
          data:  { statut: "LIVREE", dateLivraison: new Date() },
          include: { lignes: { include: { produit: { select: { id: true, nom: true } } } } },
        });
      });

      return NextResponse.json({
        success: true,
        message: `Livraison validée — ${lignesRecues.length} ligne(s) traitée(s)`,
        data: {
          ...updated,
          datePrevisionnelle: updated.datePrevisionnelle.toISOString(),
          dateLivraison:      updated.dateLivraison?.toISOString() ?? null,
        },
      });
    }

    return NextResponse.json({ message: "Action invalide (demarrer|annuler|valider)" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /api/rpv/livraisons/[id] error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
