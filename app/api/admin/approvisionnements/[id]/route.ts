import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { notifyRoles, notifyAdmins, auditLog } from "@/lib/notifications";
import { enregistrerChangementPrix } from "@/lib/prixProduit";

type Ctx = { params: Promise<{ id: string }> };

async function getAdminSession() {
  const s = await getAuthSession();
  if (!s || !["ADMIN", "SUPER_ADMIN"].includes(s.user.role ?? "")) return null;
  return s;
}

/**
 * GET /api/admin/approvisionnements/[id]
 * Détail d'une réception d'approvisionnement (toutes origines : logistique + admin).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reception = await prisma.receptionApprovisionnement.findUnique({
      where: { id: Number(id) },
      include: {
        pointDeVente:   { select: { id: true, nom: true, code: true, type: true } },
        fournisseur:    { select: { id: true, nom: true, contact: true, telephone: true } },
        origineDepot:   { select: { id: true, nom: true, code: true } },
        receptionnePar: { select: { id: true, nom: true, prenom: true } },
        validePar:      { select: { id: true, nom: true, prenom: true } },
        lignes: {
          include: {
            produit: {
              select: { id: true, nom: true, reference: true, unite: true, prixUnitaire: true, prixAchat: true },
            },
          },
        },
      },
    });

    if (!reception) return NextResponse.json({ error: "Réception introuvable" }, { status: 404 });
    return NextResponse.json({ data: reception });
  } catch (error) {
    console.error("GET /admin/approvisionnements/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/approvisionnements/[id]
 *
 * Actions (body.action) :
 * - "APPROUVER"  → Étape 2 du processus d'achat : admin valide la commande
 *                  (vérifie prix d'achat + fournisseur) : BROUILLON → EN_COURS
 *                  Peut également mettre à jour les prixUnitaire des lignes avant d'approuver.
 * - "REJETER"    → Annule la commande (admin refuse) : libère le transit
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { action, lignesPrix, motif } = body;

    const reception = await prisma.receptionApprovisionnement.findUnique({
      where: { id: Number(id) },
      include: {
        lignes: { include: { produit: { select: { id: true, nom: true } } } },
        pointDeVente:   { select: { nom: true } },
        receptionnePar: { select: { id: true, nom: true, prenom: true } },
      },
    });
    if (!reception) return NextResponse.json({ error: "Réception introuvable" }, { status: 404 });

    // ─ APPROUVER (étape 2 — validation admin) ─────────────────────────────
    if (action === "APPROUVER") {
      if (reception.statut !== "BROUILLON") {
        return NextResponse.json({
          error: `Impossible d'approuver : statut actuel "${reception.statut}" (attendu : BROUILLON)`,
        }, { status: 400 });
      }

      const updated = await prisma.$transaction(async (tx) => {
        // L'admin peut corriger les prix d'achat avant d'approuver
        // lignesPrix: [{ ligneId, prixUnitaire }]
        if (Array.isArray(lignesPrix) && lignesPrix.length > 0) {
          for (const lp of lignesPrix as Array<{ ligneId: number; prixUnitaire: number | string | null }>) {
            const hasPrix = lp.prixUnitaire !== undefined && lp.prixUnitaire !== null && lp.prixUnitaire !== "";
            if (hasPrix && Number(lp.prixUnitaire) < 0) continue; // ignorer les prix négatifs
            await tx.ligneReceptionAppro.update({
              where: { id: Number(lp.ligneId) },
              data: { prixUnitaire: hasPrix ? new Prisma.Decimal(Number(lp.prixUnitaire)) : null },
            });
            // Mettre à jour le prix d'achat de référence du produit
            if (hasPrix) {
              const ligne = reception.lignes.find(l => l.id === Number(lp.ligneId));
              if (ligne) {
                // Traçabilité prix : journaliser le changement de prix d'achat (appro)
                await enregistrerChangementPrix(tx, {
                  produitId:        ligne.produitId,
                  nouveauPrixAchat: Number(lp.prixUnitaire),
                  source:           "APPRO",
                  motif:            `Approbation réception ${reception.reference}`,
                  receptionApproId: Number(id),
                  userId:           parseInt(session.user.id),
                });
                await tx.produit.update({
                  where: { id: ligne.produitId },
                  data:  { prixAchat: new Prisma.Decimal(Number(lp.prixUnitaire)) },
                });
              }
            }
          }
        }

        // Approuver : passer EN_COURS
        const r = await tx.receptionApprovisionnement.update({
          where: { id: Number(id) },
          data:  { statut: "EN_COURS", valideParId: parseInt(session.user.id) },
        });

        await auditLog(tx, parseInt(session.user.id), "RECEPTION_APPROUVEE_ADMIN", "ReceptionApprovisionnement", r.id);

        // Notifier le responsable approvisionnement que sa commande est approuvée
        await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "MAGAZINIER"], {
          titre:    `Commande approuvée : ${reception.reference}`,
          message:  `L'administrateur ${session.user.prenom} ${session.user.nom} a approuvé la commande "${reception.reference}" pour "${reception.pointDeVente.nom}". Vous pouvez procéder à la réception physique.`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl:`/dashboard/logistique/receptions/${id}`,
        });

        return r;
      });

      return NextResponse.json({ data: updated });
    }

    // ─ REJETER (admin refuse la commande) ─────────────────────────────────
    if (action === "REJETER") {
      if (!["BROUILLON", "EN_COURS"].includes(reception.statut)) {
        return NextResponse.json({ error: "Cette réception ne peut plus être annulée" }, { status: 400 });
      }

      const updated = await prisma.$transaction(async (tx) => {
        // Libérer le transit (4.3) — la commande est refusée
        for (const ligne of reception.lignes) {
          await tx.stockSite.updateMany({
            where: { produitId: ligne.produitId, pointDeVenteId: reception.pointDeVenteId },
            data:  { quantiteEnTransit: { decrement: ligne.quantiteAttendue } },
          });
        }

        const r = await tx.receptionApprovisionnement.update({
          where: { id: Number(id) },
          data:  { statut: "ANNULE", notesQualite: motif || null },
        });

        await auditLog(tx, parseInt(session.user.id), "RECEPTION_REJETEE_ADMIN", "ReceptionApprovisionnement", r.id);

        // Notifier le responsable appro du refus
        await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "MAGAZINIER"], {
          titre:    `Commande refusée : ${reception.reference}`,
          message:  `L'administrateur ${session.user.prenom} ${session.user.nom} a refusé la commande "${reception.reference}" pour "${reception.pointDeVente.nom}".${motif ? ` Motif : ${motif}` : ""}`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl:`/dashboard/logistique/receptions/${id}`,
        });

        return r;
      });

      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Action invalide. Actions possibles : APPROUVER, REJETER" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /admin/approvisionnements/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
