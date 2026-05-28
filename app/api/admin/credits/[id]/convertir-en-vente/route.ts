import { NextResponse } from "next/server";
import {
  PrioriteNotification, Role, StatutCredit,
  StatutVenteDirecte, TypeMouvement, TypeSortieStock,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

type Ctx = { params: Promise<{ id: string }> };

/**
 * ==========================
 * POST /api/admin/credits/[id]/convertir-en-vente
 * ==========================
 * Convertit un crédit REJETE en VenteDirecte au comptant.
 *
 * Body: {
 *   modePaiement?: "ESPECES" | "MOBILE_MONEY" | "VIREMENT" | "CHEQUE"  (défaut: ESPECES)
 *   caissePDVId?:  number
 * }
 *
 * Pré-requis : crédit en statut REJETE avec un pointDeVenteId.
 * Résultat   : VenteDirecte CONFIRMEE avec les mêmes lignes de produits.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const modePaiement: string = body.modePaiement ?? "ESPECES";
    const caissePDVId: number | null = body.caissePDVId ? Number(body.caissePDVId) : null;

    const result = await prisma.$transaction(async (tx) => {
      // ── Charger le crédit ──────────────────────────────────────────────────
      const credit = await tx.creditClient.findUnique({
        where: { id: creditId },
        include: {
          client: { select: { id: true, nom: true, prenom: true } },
          lignes: {
            where:  { produitId: { not: null } },
            select: { produitId: true, produitNom: true, quantite: true, prixUnitaire: true, montantLigne: true },
          },
        },
      });

      if (!credit)                                throw new Error("CREDIT_INTROUVABLE");
      if (credit.statut !== StatutCredit.REJETE)  throw new Error("CREDIT_NON_REJETE");
      if (!credit.pointDeVenteId)                 throw new Error("PDV_MANQUANT");
      if (credit.lignes.length === 0)             throw new Error("AUCUNE_LIGNE_PRODUIT");

      // ── Référence de vente ────────────────────────────────────────────────
      const dateStr  = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const countVte = await tx.venteDirecte.count();
      const refVente = `VD-${dateStr}-${String(countVte + 1).padStart(4, "0")}`;

      const montantTotal = credit.lignes.reduce((s, l) => s + Number(l.montantLigne), 0);

      // ── Créer la VenteDirecte ─────────────────────────────────────────────
      const vente = await tx.venteDirecte.create({
        data: {
          reference:      refVente,
          statut:         StatutVenteDirecte.CONFIRMEE,
          pointDeVenteId: credit.pointDeVenteId,
          vendeurId:      Number(session.user.id),
          clientId:       credit.clientId ?? undefined,
          caissePDVId:    caissePDVId ?? undefined,
          montantTotal,
          montantPaye:    montantTotal,
          monnaieRendue:  0,
          modePaiement:   modePaiement as never,
          lignes: {
            create: credit.lignes.map((l) => ({
              produitId:    l.produitId!,
              quantite:     l.quantite,
              prixUnitaire: l.prixUnitaire,
              montant:      l.montantLigne,
            })),
          },
        },
      });

      // ── Décrémentation du stock pour chaque ligne ─────────────────────────
      for (const ligne of credit.lignes) {
        // Vérifier le stock disponible (quantite - quantiteReservee) avant de décrémenter
        const stock = await tx.stockSite.findUnique({
          where: { produitId_pointDeVenteId: { produitId: ligne.produitId!, pointDeVenteId: credit.pointDeVenteId! } },
        });
        const qteDispo = (stock?.quantite ?? 0) - (stock?.quantiteReservee ?? 0);
        if (qteDispo < ligne.quantite) {
          throw new Error(`STOCK_INSUFFISANT:${ligne.produitNom ?? ligne.produitId}:${qteDispo}`);
        }

        await tx.stockSite.updateMany({
          where: { produitId: ligne.produitId!, pointDeVenteId: credit.pointDeVenteId! },
          data:  { quantite: { decrement: ligne.quantite } },
        });

        const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
        await tx.mouvementStock.create({
          data: {
            produitId:      ligne.produitId!,
            pointDeVenteId: credit.pointDeVenteId!,
            type:           TypeMouvement.SORTIE,
            typeSortie:     TypeSortieStock.VENTE_DIRECTE,
            quantite:       ligne.quantite,
            prixUnitaire:   ligne.prixUnitaire,
            venteDirecteId: vente.id,
            motif:          `Conversion crédit rejeté ${credit.reference} → vente comptant`,
            reference:      `MVT-CONV-${creditId}-P${ligne.produitId}-${ts}`,
            operateurId:    Number(session.user.id),
          },
        });
      }

      // ── Audit log ─────────────────────────────────────────────────────────
      await tx.auditLog.create({
        data: {
          action:   "CONVERSION_CREDIT_EN_VENTE",
          entite:   "CreditClient",
          entiteId: creditId,
          userId:   Number(session.user.id),
        },
      });

      // ── Notifications ─────────────────────────────────────────────────────
      const admins = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });
      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((u) => ({
            userId:    u.id,
            titre:     "Crédit converti en vente comptant",
            message:   `Le crédit rejeté ${credit.reference} de ${credit.client.prenom} ${credit.client.nom} a été converti en vente directe (${refVente}).`,
            priorite:  PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/admin/ventes/${vente.id}`,
          })),
        });
      }

      return { vente, credit: { id: creditId, reference: credit.reference } };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/admin/credits/[id]/convertir-en-vente", error);
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CREDIT_INTROUVABLE:   ["Crédit introuvable", 404],
        CREDIT_NON_REJETE:    ["Seuls les crédits REJETÉS peuvent être convertis en vente comptant", 422],
        PDV_MANQUANT:         ["Ce crédit n'est associé à aucun point de vente — conversion impossible", 422],
        AUCUNE_LIGNE_PRODUIT: ["Aucune ligne de produit valide pour créer la vente", 422],
      };
      if (error.message.startsWith("STOCK_INSUFFISANT:")) {
        const [, produitNom, qteDispo] = error.message.split(":");
        return NextResponse.json(
          { message: `Stock insuffisant pour "${produitNom}". Disponible : ${qteDispo} — conversion impossible.` },
          { status: 422 }
        );
      }
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ message: msg }, { status });
      }
    }
    return NextResponse.json({ message: "Erreur lors de la conversion en vente" }, { status: 500 });
  }
}
