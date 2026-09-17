import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReclamationSession } from "@/lib/authReclamation";
import { resolvePdvIdsAutorises } from "@/lib/reclamationClient";
import { genererReferenceUnique } from "@/lib/depotVente";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * "Fiche de retour marchandise" (CDC §5.8) — déclaration du retour, à charge
 * ensuite du magasinier de réceptionner puis valider (devient alors le "Bon
 * de retour", cf. /api/magasinier/retours-client/[id]).
 */

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
    if (!pointDeVenteId) return NextResponse.json({ error: "Point de vente obligatoire" }, { status: 400 });

    const lignes = Array.isArray(body.lignes) ? body.lignes : [];
    if (!lignes.length) return NextResponse.json({ error: "Au moins une ligne de retour est requise" }, { status: 400 });

    const userId = Number(session.user.id);

    const retour = await genererReferenceUnique(
      "RET",
      () => prisma.retourMarchandiseClient.count(),
      (numero) => prisma.$transaction(async (tx) => {
        const r = await tx.retourMarchandiseClient.create({
          data: {
            numero,
            reclamationId,
            pointDeVenteId,
            lignes: {
              create: lignes
                .filter((l: { produitId?: number; quantite?: number }) => l.produitId && l.quantite)
                .map((l: { produitId: number; quantite: number; etatProduit?: string }) => ({
                  produitId: Number(l.produitId),
                  quantite: Number(l.quantite),
                  etatProduit: l.etatProduit?.trim() || null,
                })),
            },
          },
          include: { lignes: { include: { produit: { select: { id: true, nom: true } } } } },
        });
        await tx.actionReclamation.create({
          data: { reclamationId, type: "RETOUR_ORGANISE", description: `Fiche de retour ${r.numero} créée`, auteurId: userId },
        });
        if (reclamation.statut === "ENREGISTREE") {
          await tx.reclamationClient.update({ where: { id: reclamationId }, data: { statut: "EN_TRAITEMENT" } });
        }
        await auditLog(tx, userId, "RETOUR_MARCHANDISE_DECLARE", "RetourMarchandiseClient", r.id, undefined, getRequestMeta(req));
        await notifyRoles(tx, ["MAGAZINIER", "RESPONSABLE_POINT_DE_VENTE"], {
          titre: `Retour marchandise à réceptionner — ${r.numero}`,
          message: `Réclamation ${reclamation.numero} : un retour de marchandise attend réception au magasin.`,
          priorite: "NORMAL",
          actionUrl: `/dashboard/user/magasiniers/retours-client?detail=${r.id}`,
        });
        return r;
      }),
    );

    return NextResponse.json({ data: retour }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/reclamations/[id]/retours:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
