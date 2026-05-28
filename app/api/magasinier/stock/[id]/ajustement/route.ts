import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/magasinier/stock/[id]/ajustement
 * Body: { type: "ENTREE" | "AJUSTEMENT", quantite, motif }
 *
 * - type ENTREE    → réception directe, appliquée immédiatement
 * - type AJUSTEMENT → crée une DemandeAjustementStock EN_ATTENTE (validation admin requise)
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const produitId = Number(id);
    if (isNaN(produitId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: parseInt(session.user.id), actif: true },
      select: { pointDeVenteId: true },
    });
    const pdvId = aff?.pointDeVenteId;
    if (!pdvId) return NextResponse.json({ error: "Aucun point de vente associé à ce magasinier" }, { status: 400 });

    const body = await req.json();
    const { type, quantite, motif } = body;

    if (!type || quantite === undefined || !motif?.trim()) {
      return NextResponse.json({ error: "type, quantite et motif sont obligatoires" }, { status: 400 });
    }

    const qty = Number(quantite);
    if (qty === 0) return NextResponse.json({ error: "La quantité ne peut pas être 0" }, { status: 400 });

    const stockActuel = await prisma.stockSite.findUnique({
      where: { produitId_pointDeVenteId: { produitId, pointDeVenteId: pdvId } },
      include: { produit: { select: { nom: true } } },
    });

    const qteActuelle = stockActuel?.quantite ?? 0;
    const qteReservee = stockActuel?.quantiteReservee ?? 0;
    const produitNom  = stockActuel?.produit.nom ?? String(produitId);

    // ── ENTREE : réception directe ────────────────────────────────────────────
    if (type === "ENTREE") {
      const qteNouvelle = qteActuelle + Math.abs(qty);

      const result = await prisma.$transaction(async (tx) => {
        const stock = await tx.stockSite.upsert({
          where:  { produitId_pointDeVenteId: { produitId, pointDeVenteId: pdvId } },
          update: { quantite: qteNouvelle },
          create: { produitId, pointDeVenteId: pdvId, quantite: qteNouvelle },
        });

        const mouvement = await tx.mouvementStock.create({
          data: {
            produitId,
            pointDeVenteId: pdvId,
            type:       "ENTREE",
            typeEntree: "AJUSTEMENT_POSITIF",
            quantite:   Math.abs(qty),
            motif:      `${motif.trim()} (par ${session.user.prenom} ${session.user.nom})`,
            reference:  `MAG-ENT-${randomUUID().slice(0, 8).toUpperCase()}`,
            operateurId: parseInt(session.user.id),
          },
        });

        await auditLog(tx, parseInt(session.user.id), "RECEPTION_STOCK_MAGASINIER", "MouvementStock", mouvement.id);

        await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {
          titre:    `Réception stock : ${produitNom}`,
          message:  `${session.user.prenom} ${session.user.nom} a réceptionné ${Math.abs(qty)} unité(s) de "${produitNom}" : ${qteActuelle} → ${qteNouvelle}. Motif : ${motif.trim()}.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/magasinier/stock/${produitId}`,
        });

        return { mouvement, stock };
      });

      return NextResponse.json({ data: result }, { status: 201 });
    }

    // ── AJUSTEMENT : demande soumise à validation admin ───────────────────────
    if (type === "AJUSTEMENT") {
      const qteNouvelle = qteActuelle + qty;

      if (qteNouvelle < 0) {
        return NextResponse.json(
          { error: `Stock insuffisant. Stock actuel : ${qteActuelle}, ajustement : ${qty}` },
          { status: 400 }
        );
      }
      if (qteNouvelle < qteReservee) {
        return NextResponse.json(
          { error: `Ajustement impossible : le nouveau stock (${qteNouvelle}) serait inférieur aux quantités réservées (${qteReservee})` },
          { status: 400 }
        );
      }

      const demande = await prisma.$transaction(async (tx) => {
        const d = await tx.demandeAjustementStock.create({
          data: {
            produitId,
            pointDeVenteId:   pdvId,
            ancienneQuantite: qteActuelle,
            nouvelleQuantite: qteNouvelle,
            justification:    motif.trim(),
            demandeurId:      parseInt(session.user.id),
            source:           "MAGAZINIER",
          },
        });

        // Notifier Resp.Appro pour pré-validation (niveau 2) — l'Admin sera notifié après
        await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {
          titre:    `Demande d'ajustement inventaire — ${produitNom}`,
          message:  `${session.user.prenom} ${session.user.nom} (magasinier) demande un ajustement de stock pour "${produitNom}" : ${qteActuelle} → ${qteNouvelle} (${qty > 0 ? "+" : ""}${qty}). Justification : ${motif.trim()}. Pré-validez avant transmission à l'admin.`,
          priorite: "HAUTE",
          actionUrl: "/dashboard/user/logistiquesApprovisionnements",
        });

        await auditLog(tx, parseInt(session.user.id), "DEMANDE_AJUSTEMENT_STOCK_CREEE", "DemandeAjustementStock", d.id);
        return d;
      });

      return NextResponse.json({ data: demande, enAttente: true }, { status: 201 });
    }

    return NextResponse.json({ error: "type invalide : ENTREE ou AJUSTEMENT" }, { status: 400 });
  } catch (error) {
    console.error("POST /magasinier/stock/[id]/ajustement:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
