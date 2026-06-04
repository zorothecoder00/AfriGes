import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

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
          include: { enregistrePar: { select: { id: true, nom: true, prenom: true } } },
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
 * Modifie les métadonnées d'un crédit EN_ATTENTE_VALIDATION (durée, date début, garantie, observations).
 * Recalcule montantJournalier et dateEcheanceFin.
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
        select: { id: true, statut: true, pointDeVenteId: true, montantTotal: true, dureeJours: true, dateDebut: true },
      });
      if (!credit) throw new Error("CREDIT_INTROUVABLE");
      if (credit.statut !== "EN_ATTENTE_VALIDATION") throw new Error("CREDIT_NON_MODIFIABLE");
      if (rvcPdvId !== null && credit.pointDeVenteId !== rvcPdvId) throw new Error("ACCES_REFUSE");

      const duree = body.dureeJours != null ? Number(body.dureeJours) : credit.dureeJours;
      if (duree < 1) throw new Error("DUREE_INVALIDE");
      const debut = body.dateDebut ? new Date(body.dateDebut) : credit.dateDebut;

      const montantJournalier = Number((Number(credit.montantTotal) / duree).toFixed(2));
      const dateEcheanceFin   = new Date(debut);
      dateEcheanceFin.setDate(dateEcheanceFin.getDate() + duree);

      return tx.creditClient.update({
        where: { id: creditId },
        data: {
          dureeJours:      duree,
          dateDebut:       debut,
          montantJournalier,
          dateEcheanceFin,
          ...(body.garantie     !== undefined && { garantie:     body.garantie }),
          ...(body.observations !== undefined && { observations: body.observations }),
        },
      });
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CREDIT_INTROUVABLE:    ["Crédit introuvable", 404],
        CREDIT_NON_MODIFIABLE: ["Seuls les crédits EN_ATTENTE_VALIDATION peuvent être modifiés", 422],
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
