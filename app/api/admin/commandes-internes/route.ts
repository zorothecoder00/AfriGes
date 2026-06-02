import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * POST /api/admin/commandes-internes
 * Crée une ReceptionApprovisionnement (type INTERNE, statut BROUILLON) par PDV
 * depuis les prévisions d'approvisionnement.
 * Cela alimente dashboard/admin/approvisionnements et met les produits en transit dans le stock.
 * Body: { lignes: [{produitId, pointDeVenteId, quantite}], notes? }
 */
export async function POST(req: Request) {
  try {
    const session = (await getAdminSession()) ?? (await getLogistiqueSession());
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { lignes, notes } = await req.json() as {
      lignes: Array<{ produitId: number; pointDeVenteId: number | null; quantite: number }>;
      notes?: string;
    };

    if (!lignes?.length) {
      return NextResponse.json({ error: "Aucune ligne fournie" }, { status: 400 });
    }

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const userId  = parseInt(session.user.id);

    // Pour non-admin : limiter aux lignes de leur PDV uniquement
    let allowedPdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId, actif: true },
        select: { pointDeVenteId: true },
      });
      allowedPdvId = aff?.pointDeVenteId ?? null;
    }

    // Regrouper par PDV — les lignes sans PDV sont ignorées (pointDeVenteId requis)
    const byPdv = new Map<number, typeof lignes>();
    for (const l of lignes) {
      if (!l.pointDeVenteId) continue;
      // Non-admin : ignorer les lignes qui ne correspondent pas à leur PDV
      if (!isAdmin && allowedPdvId && l.pointDeVenteId !== allowedPdvId) continue;
      const key = l.pointDeVenteId;
      if (!byPdv.has(key)) byPdv.set(key, []);
      byPdv.get(key)!.push(l);
    }

    if (!byPdv.size) {
      return NextResponse.json({ error: "Toutes les lignes doivent avoir un point de vente assigné" }, { status: 400 });
    }

    const adminId = parseInt(session.user.id);
    // Date prévisionnelle : dans 7 jours
    const datePrevisionnelle = new Date();
    datePrevisionnelle.setDate(datePrevisionnelle.getDate() + 7);

    const receptions = await prisma.$transaction(async (tx) => {
      const created = [];

      for (const [pdvId, pdvLignes] of byPdv.entries()) {
        const ref = `REC-INT-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

        const pdv = await tx.pointDeVente.findUnique({ where: { id: pdvId }, select: { nom: true } });

        // Créer une ReceptionApprovisionnement INTERNE (BROUILLON = en attente approbation admin)
        const r = await tx.receptionApprovisionnement.create({
          data: {
            reference:          ref,
            type:               "INTERNE",
            statut:             "EN_COURS",
            pointDeVenteId:     pdvId,
            origineNom:         "Siège / Prévisions souscriptions",
            datePrevisionnelle,
            notes:              notes || null,
            receptionneParId:   adminId,
            lignes: {
              create: pdvLignes.map(l => ({
                produitId:        Number(l.produitId),
                quantiteAttendue: Number(l.quantite),
              })),
            },
          },
          include: {
            lignes: { select: { produitId: true, quantiteAttendue: true } },
          },
        });

        // Mettre les quantités en transit dans StockSite
        for (const ligne of r.lignes) {
          await tx.stockSite.upsert({
            where:  { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: pdvId } },
            update: { quantiteEnTransit: { increment: ligne.quantiteAttendue } },
            create: { produitId: ligne.produitId, pointDeVenteId: pdvId, quantiteEnTransit: ligne.quantiteAttendue },
          });
        }

        await auditLog(tx, adminId, "RECEPTION_INTERNE_CREEE", "ReceptionApprovisionnement", r.id);

        await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "MAGAZINIER"], {
          titre:    `Réception à traiter : ${ref}`,
          message:  `L'admin a lancé une commande interne${pdv ? ` pour "${pdv.nom}"` : ""} (${r.lignes.length} produit(s)). À réceptionner puis valider.`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/admin/approvisionnements`,
        });

        created.push({ id: r.id, reference: ref, pdvId, nbLignes: r.lignes.length });
      }

      return created;
    });

    return NextResponse.json({ data: receptions, count: receptions.length }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/commandes-internes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
