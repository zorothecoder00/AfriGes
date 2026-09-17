import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReclamationSession } from "@/lib/authReclamation";
import { resolvePdvIdsAutorises } from "@/lib/reclamationClient";
import { genererReferenceUnique } from "@/lib/depotVente";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/** "Bon de remplacement" (CDC §5.8) — organise le remplacement d'un produit défectueux. */

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getReclamationSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reclamationId = Number(id);
    const pdvIds = await resolvePdvIdsAutorises(session);

    const reclamation = await prisma.reclamationClient.findUnique({
      where: { id: reclamationId },
      select: { id: true, numero: true, statut: true, pointDeVenteId: true },
    });
    if (!reclamation) return NextResponse.json({ error: "Réclamation introuvable" }, { status: 404 });
    if (pdvIds !== null && (!reclamation.pointDeVenteId || !pdvIds.includes(reclamation.pointDeVenteId))) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (reclamation.statut === "CLOTUREE" || reclamation.statut === "REJETEE") {
      return NextResponse.json({ error: "Réclamation déjà close" }, { status: 409 });
    }

    const body = await req.json();
    const pointDeVenteId = Number(body.pointDeVenteId || reclamation.pointDeVenteId);
    const produitOrigineId = Number(body.produitOrigineId);
    const produitRemplacementId = Number(body.produitRemplacementId);
    const quantite = Number(body.quantite);

    if (!pointDeVenteId) return NextResponse.json({ error: "Point de vente obligatoire" }, { status: 400 });
    if (!produitOrigineId || !produitRemplacementId) return NextResponse.json({ error: "Produits d'origine et de remplacement obligatoires" }, { status: 400 });
    if (!quantite || quantite <= 0) return NextResponse.json({ error: "Quantité invalide" }, { status: 400 });

    const userId = Number(session.user.id);

    const remplacement = await genererReferenceUnique(
      "BREM",
      () => prisma.remplacementProduit.count(),
      (numero) => prisma.$transaction(async (tx) => {
        const r = await tx.remplacementProduit.create({
          data: { numero, reclamationId, pointDeVenteId, produitOrigineId, produitRemplacementId, quantite },
          include: {
            produitOrigine: { select: { id: true, nom: true } },
            produitRemplacement: { select: { id: true, nom: true } },
          },
        });
        await tx.actionReclamation.create({
          data: { reclamationId, type: "REMPLACEMENT_ORGANISE", description: `Bon de remplacement ${r.numero} créé`, auteurId: userId },
        });
        if (reclamation.statut === "ENREGISTREE") {
          await tx.reclamationClient.update({ where: { id: reclamationId }, data: { statut: "EN_TRAITEMENT" } });
        }
        await auditLog(tx, userId, "REMPLACEMENT_PRODUIT_DEMANDE", "RemplacementProduit", r.id, undefined, getRequestMeta(req));
        await notifyRoles(tx, ["MAGAZINIER", "RESPONSABLE_POINT_DE_VENTE"], {
          titre: `Remplacement à préparer — ${r.numero}`,
          message: `Réclamation ${reclamation.numero} : un remplacement de produit attend approbation/livraison au magasin.`,
          priorite: "NORMAL",
          actionUrl: `/dashboard/user/magasiniers/remplacements?detail=${r.id}`,
        });
        return r;
      }),
    );

    return NextResponse.json({ data: remplacement }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/reclamations/[id]/remplacements:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
