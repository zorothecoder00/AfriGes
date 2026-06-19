import { NextResponse } from "next/server";
import { StatutCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

type Ctx = { params: Promise<{ id: string }> };

/**
 * ==========================
 * GET /api/admin/credits/[id]
 * ==========================
 * Détail complet d'un crédit
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const credit = await prisma.creditClient.findUnique({
      where: { id: creditId },
      include: {
        client:   { select: { id: true, nom: true, prenom: true, codeClient: true, telephone: true, niveauRisque: true, limiteCredit: true, soldeActuel: true } },
        creePar:  { select: { id: true, nom: true, prenom: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
        lignes: {
          orderBy: { id: "asc" },
          include: {
            produit:          { select: { id: true, nom: true, reference: true } },
            produitSubstitut: { select: { id: true, nom: true } },
            traitePar:        { select: { id: true, nom: true, prenom: true } },
          },
        },
        echeances: {
          orderBy: { numeroEcheance: "asc" },
        },
        remboursements: {
          orderBy: { dateRemboursement: "desc" },
          include: { enregistrePar: { select: { id: true, nom: true, prenom: true } } },
        },
      },
    });

    if (!credit) return NextResponse.json({ message: "Crédit introuvable" }, { status: 404 });

    return NextResponse.json({ data: credit });
  } catch (error) {
    console.error("GET /api/admin/credits/[id]", error);
    return NextResponse.json({ message: "Erreur lors de la récupération du crédit" }, { status: 500 });
  }
}

/**
 * ==========================
 * PATCH /api/admin/credits/[id]
 * ==========================
 * Modifier un crédit (uniquement si statut = EN_ATTENTE_VALIDATION)
 *
 * Body: {
 *   lignes?, dureeJours?, dateDebut?,
 *   tauxPenalite?, garantie?, observations?
 * }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { lignes, dureeJours, dateDebut, tauxPenalite, garantie, observations } = body;

    const result = await prisma.$transaction(async (tx) => {
      const credit = await tx.creditClient.findUnique({ where: { id: creditId } });
      if (!credit) throw new Error("CREDIT_INTROUVABLE");
      if (credit.statut !== StatutCredit.EN_ATTENTE_VALIDATION) throw new Error("CREDIT_NON_MODIFIABLE");

      // ── Recalcul si lignes fournies ───────────────────────────────────────
      let montantTotal = Number(credit.montantTotal);

      if (lignes !== undefined) {
        if (!Array.isArray(lignes) || lignes.length === 0) throw new Error("LIGNES_INVALIDES");

        const lignesCalculees = (lignes as {
          produitId?: number;
          produitNom: string;
          quantite: number;
          prixUnitaire: number;
          remise?: number;
        }[]).map((l) => {
          const qte = Number(l.quantite);
          const pu  = Number(l.prixUnitaire);
          const rem = Number(l.remise || 0);
          return { ...l, qte, pu, rem, montantLigne: Number((pu * qte - rem).toFixed(2)) };
        });

        montantTotal = Number(lignesCalculees.reduce((s, l) => s + l.montantLigne, 0).toFixed(2));
        if (montantTotal <= 0) throw new Error("MONTANT_INVALIDE");

        await tx.ligneCreditClient.deleteMany({ where: { creditId } });
        await tx.ligneCreditClient.createMany({
          data: lignesCalculees.map((l) => ({
            creditId,
            produitId:        l.produitId ? Number(l.produitId) : null,
            produitNom:       l.produitNom,
            produitNomSaisi:  l.produitNom,
            quantite:         l.qte,
            prixUnitaire:     l.pu,
            remise:           l.rem,
            montantLigne:     l.montantLigne,
            statut:           "EN_ATTENTE" as const,
            estNouveauProduit: !l.produitId,
            pointDeVenteId:   credit.pointDeVenteId,
          })),
        });
      }

      // ── Recalcul de l'échéancier ──────────────────────────────────────────
      const duree = dureeJours !== undefined ? Number(dureeJours) : credit.dureeJours;
      if (duree < 1) throw new Error("DUREE_INVALIDE");

      const debut = dateDebut !== undefined ? new Date(dateDebut) : credit.dateDebut;
      const montantJournalier = Number((montantTotal / duree).toFixed(2));
      const dateEcheanceFin   = new Date(debut);
      dateEcheanceFin.setDate(dateEcheanceFin.getDate() + duree);

      const updated = await tx.creditClient.update({
        where: { id: creditId },
        data: {
          montantTotal,
          soldeRestant: montantTotal,
          dureeJours: duree,
          dateDebut:  debut,
          dateEcheanceFin,
          montantJournalier,
          ...(tauxPenalite  !== undefined && { tauxPenalite:  Number(tauxPenalite) }),
          ...(garantie      !== undefined && { garantie:      garantie || null }),
          ...(observations  !== undefined && { observations:  observations || null }),
        },
      });

      await tx.auditLog.create({
        data: {
          action: "MODIFICATION_CREDIT",
          entite: "CreditClient",
          entiteId: creditId,
          userId: Number(session.user.id),
        },
      });

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    console.error("PATCH /api/admin/credits/[id]", error);
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CREDIT_INTROUVABLE:   ["Crédit introuvable", 404],
        CREDIT_NON_MODIFIABLE: ["Seuls les crédits EN_ATTENTE_VALIDATION peuvent être modifiés", 422],
        LIGNES_INVALIDES:     ["Les lignes de produits sont invalides", 400],
        MONTANT_INVALIDE:     ["Le montant total doit être positif", 400],
        DUREE_INVALIDE:       ["La durée doit être d'au moins 1 jour", 400],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ message: msg }, { status });
      }
    }

    return NextResponse.json({ message: "Erreur lors de la modification du crédit" }, { status: 500 });
  }
}

/**
 * ==========================
 * DELETE /api/admin/credits/[id]
 * ==========================
 * Supprime un crédit (uniquement EN_ATTENTE_VALIDATION ou REJETE, sans opération liée).
 * Les lignes, échéances et remboursements sont supprimés en cascade (schéma).
 */
const STATUTS_SUPPRIMABLES: StatutCredit[] = [
  StatutCredit.EN_ATTENTE_VALIDATION,
  StatutCredit.REJETE,
];

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      const credit = await tx.creditClient.findUnique({
        where: { id: creditId },
        select: {
          statut: true,
          _count: { select: { livraisons: true, facturesVente: true, financementsRIA: true } },
        },
      });
      if (!credit) throw new Error("CREDIT_INTROUVABLE");
      if (!STATUTS_SUPPRIMABLES.includes(credit.statut)) throw new Error("CREDIT_NON_SUPPRIMABLE");
      if (credit._count.livraisons > 0 || credit._count.facturesVente > 0 || credit._count.financementsRIA > 0) {
        throw new Error("CREDIT_LIE");
      }

      await tx.creditClient.delete({ where: { id: creditId } }); // cascade lignes/échéances/remboursements

      await tx.auditLog.create({
        data: {
          action: "SUPPRESSION_CREDIT",
          entite: "CreditClient",
          entiteId: creditId,
          userId: Number(session.user.id),
        },
      });
    });

    return NextResponse.json({ message: "Crédit supprimé" });
  } catch (error: unknown) {
    console.error("DELETE /api/admin/credits/[id]", error);
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CREDIT_INTROUVABLE:    ["Crédit introuvable", 404],
        CREDIT_NON_SUPPRIMABLE: ["Seuls les crédits en attente de validation ou rejetés peuvent être supprimés", 422],
        CREDIT_LIE:            ["Ce crédit est lié à des opérations (livraisons, factures ou financements) — suppression impossible", 422],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ message: msg }, { status });
      }
    }
    return NextResponse.json({ message: "Erreur lors de la suppression du crédit" }, { status: 500 });
  }
}
