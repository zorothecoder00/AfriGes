import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionLivraison } from "@/lib/tourneeLivraison";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { PrioriteNotification } from "@prisma/client";
import { INCLUDE } from "../../../route";

type Ctx = { params: Promise<{ id: string; arretId: string }> };

interface RetourLigneInput { produitId: number; quantite: number; motif?: string }

/**
 * PATCH /api/logistique/tournees/[id]/arrets/[arretId]
 * Constate le résultat d'un arrêt — "Rapport de livraison" (agrégation, cf.
 * /rapport), "Fiche de livraison non effectuée", "Fiche d'incident livraison",
 * "Fiche de retour marchandises" (§5.7), tous imprimables depuis cet arrêt une
 * fois constaté (FicheArretLivraison.tsx).
 *
 * Body: { statut: "EFFECTUE" | "NON_EFFECTUE" | "INCIDENT",
 *         motifNonEffectue?, incidentDescription?, signatureClientNom?,
 *         retourLignes?: [{produitId, quantite, motif?}] }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSessionLivraison();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, arretId } = await params;
    const tourneeId = Number(id);
    const aId = Number(arretId);

    const tournee = await prisma.tourneeLivraison.findUnique({ where: { id: tourneeId }, select: { statut: true, reference: true, pointDeVenteId: true } });
    if (!tournee) return NextResponse.json({ error: "Tournée introuvable" }, { status: 404 });
    if (tournee.statut !== "EN_COURS") return NextResponse.json({ error: "La tournée doit être en cours pour constater un arrêt" }, { status: 422 });

    const arret = await prisma.tourneeArret.findUnique({ where: { id: aId } });
    if (!arret || arret.tourneeId !== tourneeId) return NextResponse.json({ error: "Arrêt introuvable" }, { status: 404 });
    if (arret.statut !== "PLANIFIE") return NextResponse.json({ error: `Arrêt déjà constaté (${arret.statut})` }, { status: 422 });

    const body = await req.json();
    const statut = body.statut as string;
    if (!["EFFECTUE", "NON_EFFECTUE", "INCIDENT"].includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }
    if (statut === "NON_EFFECTUE" && !body.motifNonEffectue?.trim()) {
      return NextResponse.json({ error: "Le motif de non-livraison est obligatoire" }, { status: 400 });
    }
    if (statut === "INCIDENT" && !body.incidentDescription?.trim()) {
      return NextResponse.json({ error: "La description de l'incident est obligatoire" }, { status: 400 });
    }

    const retourInput = (body.retourLignes ?? []) as RetourLigneInput[];
    for (const r of retourInput) {
      if (!r.produitId || !r.quantite || r.quantite <= 0) {
        return NextResponse.json({ error: "Chaque ligne de retour doit avoir produitId et quantite (>0)" }, { status: 400 });
      }
    }

    const userId = parseInt(session.user.id);
    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.tourneeArret.update({
        where: { id: aId },
        data: {
          statut: statut as never,
          heureArrivee: new Date(),
          motifNonEffectue: statut === "NON_EFFECTUE" ? body.motifNonEffectue : null,
          incidentDescription: statut === "INCIDENT" ? body.incidentDescription : null,
          signatureClientNom: body.signatureClientNom || null,
          retourLignes: retourInput.length ? { create: retourInput.map((r) => ({ produitId: r.produitId, quantite: r.quantite, motif: r.motif || null })) } : undefined,
        },
      });
      await auditLog(tx, userId, `TRN_ARRET_${statut}`, "TourneeArret", aId, undefined, getRequestMeta(req));

      if (statut === "NON_EFFECTUE" || statut === "INCIDENT") {
        await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {
          titre: `${statut === "INCIDENT" ? "Incident" : "Livraison non effectuée"} — tournée ${tournee.reference}`,
          message: `Arrêt chez ${arret.clientNom} : ${statut === "INCIDENT" ? body.incidentDescription : body.motifNonEffectue}`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/user/logistiquesApprovisionnements/tournees?tournee=${tourneeId}`,
        });
      }
      return a;
    });

    const tourneeComplete = await prisma.tourneeLivraison.findUnique({ where: { id: tourneeId }, include: INCLUDE });
    return NextResponse.json({ data: updated, tournee: tourneeComplete });
  } catch (error) {
    console.error("PATCH /logistique/tournees/[id]/arrets/[arretId]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
