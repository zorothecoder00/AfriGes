import { NextResponse } from "next/server";
import { StatutCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { appliquerNouvelleDureeCredit } from "@/lib/dureeCredit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/rvc/credits/[id]
 * Détail d'un crédit (scoped au PDV du RVC)
 */
export async function GET(_req: Request, { params }: Ctx) {
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

    const credit = await prisma.creditClient.findUnique({
      where: { id: creditId },
      include: {
        client:    { select: { id: true, nom: true, prenom: true, codeClient: true, telephone: true } },
        creePar:   { select: { id: true, nom: true, prenom: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
        lignes: {
          orderBy: { id: "asc" },
          include: {
            produit:          { select: { id: true, nom: true, reference: true } },
            produitSubstitut: { select: { id: true, nom: true } },
            traitePar:        { select: { id: true, nom: true, prenom: true } },
          },
        },
        echeances:      { orderBy: { numeroEcheance: "asc" } },
        remboursements: {
          orderBy: { dateRemboursement: "desc" },
          include: {
            enregistrePar:   { select: { id: true, nom: true, prenom: true } },
            agentCollecteur: { select: { id: true, nom: true, prenom: true } },
          },
        },
      },
    });

    if (!credit) return NextResponse.json({ error: "Crédit introuvable" }, { status: 404 });
    if (rvcPdvId !== null && credit.pointDeVenteId !== rvcPdvId) {
      return NextResponse.json({ error: "Accès refusé — PDV non autorisé" }, { status: 403 });
    }

    return NextResponse.json({ data: credit });
  } catch (error) {
    console.error("GET /api/rvc/credits/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/rvc/credits/[id]
 *
 * Modifie les métadonnées d'un crédit (durée, date début, garantie, observations).
 * Autorisé sur EN_ATTENTE_VALIDATION, ACTIF et EN_RETARD. Recalcule montantJournalier,
 * dateEcheanceFin et — pour un crédit en remboursement — régénère l'échéancier en
 * réimputant le déjà-payé (montant total et solde restant inchangés).
 */
export async function PATCH(req: Request, { params }: Ctx) {
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

    const body = await req.json() as {
      dureeJours?:   number;
      dateDebut?:    string;
      garantie?:     string | null;
      observations?: string | null;
    };

    const result = await prisma.$transaction(async (tx) => {
      const credit = await tx.creditClient.findUnique({
        where: { id: creditId },
        select: { id: true, statut: true, pointDeVenteId: true, montantTotal: true, montantRembourse: true, dureeJours: true, dateDebut: true },
      });
      if (!credit) throw new Error("CREDIT_INTROUVABLE");
      // « En remboursement » = ACTIF ou EN_RETARD : l'échéancier existe et est régénéré
      // (avec réimputation du déjà-payé). EN_ATTENTE_VALIDATION reste éditable aussi.
      const estEnRemboursement = credit.statut === StatutCredit.ACTIF || credit.statut === StatutCredit.EN_RETARD;
      if (credit.statut !== StatutCredit.EN_ATTENTE_VALIDATION && !estEnRemboursement) throw new Error("CREDIT_NON_MODIFIABLE");
      if (rvcPdvId !== null && credit.pointDeVenteId !== rvcPdvId) throw new Error("ACCES_REFUSE");

      return appliquerNouvelleDureeCredit(tx, credit, body);
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CREDIT_INTROUVABLE:    ["Crédit introuvable", 404],
        CREDIT_NON_MODIFIABLE: ["Seuls les crédits en attente de validation, actifs ou en retard peuvent être modifiés", 422],
        ACCES_REFUSE:          ["Accès refusé — PDV non autorisé", 403],
        DUREE_INVALIDE:        ["La durée doit être ≥ 1 jour", 400],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ error: msg }, { status });
      }
    }
    console.error("PATCH /api/rvc/credits/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
