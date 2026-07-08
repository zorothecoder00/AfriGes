import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { montantJournalierArrondi } from "@/lib/echeancierCredit";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/rvc/credits/[id]/lignes
 *
 * Le RVC ajoute une ligne à un crédit EN_ATTENTE_VALIDATION.
 * Recalcule automatiquement le montantTotal du crédit.
 *
 * Body: { produitId?, produitNomSaisi, quantite, prixUnitaire, remise? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    let rvcPdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff) return NextResponse.json({ error: "Aucun PDV associé" }, { status: 400 });
      rvcPdvId = aff.pointDeVenteId;
    }

    const body = await req.json();
    const { produitId, produitNomSaisi, quantite, prixUnitaire, remise } = body;

    if (!produitNomSaisi && !produitId) {
      return NextResponse.json({ error: "produitId ou produitNomSaisi requis" }, { status: 400 });
    }
    if (!quantite || Number(quantite) <= 0) {
      return NextResponse.json({ error: "quantite > 0 requis" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const credit = await tx.creditClient.findUnique({
        where: { id: creditId },
        select: { id: true, statut: true, pointDeVenteId: true, dureeJours: true, dateDebut: true },
      });
      if (!credit) throw new Error("CREDIT_INTROUVABLE");
      if (credit.statut !== "EN_ATTENTE_VALIDATION") throw new Error("CREDIT_NON_MODIFIABLE");
      if (rvcPdvId !== null && credit.pointDeVenteId !== rvcPdvId) throw new Error("ACCES_REFUSE");

      const qte = Number(quantite);
      const pu  = Number(prixUnitaire || 0);
      const rem = Number(remise || 0);
      const montantLigne = Number((pu * qte - rem).toFixed(2));

      let produitNom = produitNomSaisi ?? "";
      if (produitId) {
        const produit = await tx.produit.findUnique({
          where: { id: Number(produitId) },
          select: { nom: true },
        });
        if (!produit) throw new Error("PRODUIT_INTROUVABLE");
        produitNom = produit.nom;
      }

      const ligne = await tx.ligneCreditClient.create({
        data: {
          creditId,
          produitId:         produitId ? Number(produitId) : null,
          produitNom,
          produitNomSaisi:   produitNomSaisi ?? produitNom,
          quantite:          qte,
          prixUnitaire:      pu,
          remise:            rem,
          montantLigne,
          statut:            "EN_ATTENTE",
          estNouveauProduit: !produitId,
          pointDeVenteId:    credit.pointDeVenteId,
        },
      });

      // Recalcul montantTotal
      const allLignes = await tx.ligneCreditClient.findMany({
        where: { creditId },
        select: { montantLigne: true },
      });
      const newTotal = Number(allLignes.reduce((s, l) => s + Number(l.montantLigne), 0).toFixed(2));
      const montantJournalier = montantJournalierArrondi(newTotal, credit.dureeJours);
      const dateEcheanceFin   = new Date(credit.dateDebut);
      dateEcheanceFin.setDate(dateEcheanceFin.getDate() + credit.dureeJours);

      await tx.creditClient.update({
        where: { id: creditId },
        data: { montantTotal: newTotal, soldeRestant: newTotal, montantJournalier, dateEcheanceFin },
      });

      await auditLog(tx, userId, "LIGNE_CREDIT_AJOUTEE_RVC", "CreditClient", creditId);
      return ligne;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CREDIT_INTROUVABLE:    ["Crédit introuvable", 404],
        CREDIT_NON_MODIFIABLE: ["Seuls les crédits EN_ATTENTE_VALIDATION peuvent être modifiés", 422],
        ACCES_REFUSE:          ["Accès refusé — PDV non autorisé", 403],
        PRODUIT_INTROUVABLE:   ["Produit introuvable", 404],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ error: msg }, { status });
      }
    }
    console.error("POST /api/rvc/credits/[id]/lignes", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
