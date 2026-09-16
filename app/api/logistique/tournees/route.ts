import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionLivraison } from "@/lib/tourneeLivraison";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { genererReferenceUnique } from "@/lib/depotVente";
import { PrioriteNotification } from "@prisma/client";

/**
 * Tournées de livraison (CDC digitalisation §5.7) — "Fiche de tournée" /
 * "Fiche de mission du livreur" à la création (variantes MISSION/CHARGEMENT
 * de FicheTournee.tsx), "Bordereau de livraison" à l'impression après
 * déroulement (variante BORDEREAU, même composant).
 */

export const INCLUDE = {
  livreur: { select: { id: true, nom: true, prenom: true } },
  pointDeVente: { select: { id: true, nom: true, code: true } },
  creePar: { select: { id: true, nom: true, prenom: true } },
  arrets: {
    orderBy: { ordre: "asc" as const },
    include: {
      bonLivraison: { include: { lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true } } } } } },
      retourLignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true } } } },
    },
  },
};

/** GET /api/logistique/tournees — Query: statut?, livreurId? */
export async function GET(req: Request) {
  try {
    const session = await getSessionLivraison();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const livreurId = searchParams.get("livreurId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (livreurId) where.livreurId = Number(livreurId);

    const [tournees, pdvs, livreurs, bonsLivraisonDisponibles] = await Promise.all([
      prisma.tourneeLivraison.findMany({ where, orderBy: { createdAt: "desc" }, include: INCLUDE }),
      prisma.pointDeVente.findMany({ where: { actif: true }, select: { id: true, nom: true, code: true }, orderBy: { nom: "asc" } }),
      prisma.user.findMany({
        where: { gestionnaire: { role: { in: ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "MAGAZINIER"] } } },
        select: { id: true, nom: true, prenom: true },
        orderBy: { nom: "asc" },
      }),
      prisma.bonLivraison.findMany({
        where: { tourneeArret: null },
        select: { id: true, reference: true, clientNom: true, clientTelephone: true, adresseLivraison: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);
    return NextResponse.json({ data: tournees, pdvs, livreurs, bonsLivraisonDisponibles });
  } catch (error) {
    console.error("GET /logistique/tournees:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

interface ArretInput {
  bonLivraisonId?: number;
  clientNom?: string;
  clientTelephone?: string;
  adresseLivraison?: string;
}

/**
 * POST /api/logistique/tournees
 * Body: { livreurId, pointDeVenteId, dateTournee?, moyenTransport?, notes?,
 *         arrets: [{bonLivraisonId?} | {clientNom, clientTelephone?, adresseLivraison?}] }
 */
export async function POST(req: Request) {
  try {
    const session = await getSessionLivraison();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const livreurId = Number(body.livreurId);
    const pointDeVenteId = Number(body.pointDeVenteId);
    if (!livreurId || !pointDeVenteId) {
      return NextResponse.json({ error: "Livreur et point de vente obligatoires" }, { status: 400 });
    }

    const arretsInput = (body.arrets ?? []) as ArretInput[];
    if (!arretsInput.length) return NextResponse.json({ error: "Au moins un arrêt est requis" }, { status: 400 });

    const bonLivraisonIds = arretsInput.map((a) => a.bonLivraisonId).filter((id): id is number => id != null);
    const bonsLivraison = bonLivraisonIds.length
      ? await prisma.bonLivraison.findMany({ where: { id: { in: bonLivraisonIds } }, select: { id: true, clientNom: true, clientTelephone: true, adresseLivraison: true, tourneeArret: { select: { id: true } } } })
      : [];
    const blParId = new Map(bonsLivraison.map((b) => [b.id, b]));

    for (const a of arretsInput) {
      if (a.bonLivraisonId) {
        const bl = blParId.get(a.bonLivraisonId);
        if (!bl) return NextResponse.json({ error: `Bon de livraison ${a.bonLivraisonId} introuvable` }, { status: 404 });
        if (bl.tourneeArret) return NextResponse.json({ error: `Bon de livraison ${a.bonLivraisonId} déjà affecté à une tournée` }, { status: 422 });
      } else if (!a.clientNom?.trim()) {
        return NextResponse.json({ error: "Chaque arrêt doit référencer un bon de livraison ou renseigner un client" }, { status: 400 });
      }
    }

    const userId = parseInt(session.user.id);
    const tournee = await genererReferenceUnique(
      "TRN",
      () => prisma.tourneeLivraison.count(),
      (reference) => prisma.$transaction(async (tx) => {
        const t = await tx.tourneeLivraison.create({
          data: {
            reference,
            livreurId,
            pointDeVenteId,
            dateTournee: body.dateTournee ? new Date(body.dateTournee) : new Date(),
            moyenTransport: body.moyenTransport || null,
            notes: body.notes || null,
            creeParId: userId,
            arrets: {
              create: arretsInput.map((a, i) => {
                const bl = a.bonLivraisonId ? blParId.get(a.bonLivraisonId) : null;
                return {
                  ordre: i + 1,
                  bonLivraisonId: a.bonLivraisonId ?? null,
                  clientNom: bl?.clientNom ?? a.clientNom ?? "",
                  clientTelephone: bl?.clientTelephone ?? a.clientTelephone ?? null,
                  adresseLivraison: bl?.adresseLivraison ?? a.adresseLivraison ?? null,
                };
              }),
            },
          },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "TRN_CREEE", "TourneeLivraison", t.id, undefined, getRequestMeta(req));
        await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {
          titre: `Tournée planifiée (${reference})`,
          message: `${session.user.prenom} ${session.user.nom} a planifié la tournée ${reference} (${arretsInput.length} arrêt(s)).`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/logistiquesApprovisionnements/tournees?tournee=${t.id}`,
        });
        return t;
      }),
    );
    return NextResponse.json({ data: tournee }, { status: 201 });
  } catch (error) {
    console.error("POST /logistique/tournees:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
