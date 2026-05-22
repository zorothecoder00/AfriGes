import { NextResponse } from "next/server";
import { StatutCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * ==========================
 * GET /api/admin/clients/[id]/credits
 * ==========================
 * Liste tous les crédits d'un client avec statistiques agrégées.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, nom: true, prenom: true, codeClient: true, limiteCredit: true, soldeActuel: true, niveauRisque: true },
    });
    if (!client) return NextResponse.json({ message: "Client introuvable" }, { status: 404 });

    const credits = await prisma.creditClient.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      include: {
        creePar:   { select: { id: true, nom: true, prenom: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
        lignes: {
          select: {
            id: true, produitNom: true, quantite: true,
            prixUnitaire: true, remise: true, montantLigne: true,
          },
        },
        echeances: {
          orderBy: { numeroEcheance: "asc" },
          select: {
            id: true, numeroEcheance: true, dateEcheance: true,
            montantDu: true, montantPaye: true, statut: true, penalite: true,
          },
        },
        remboursements: {
          orderBy: { dateRemboursement: "desc" },
          select: {
            id: true, montant: true, dateRemboursement: true,
            modePaiement: true, notes: true,
            enregistrePar: { select: { id: true, nom: true, prenom: true } },
          },
        },
      },
    });

    // ── Statistiques agrégées ─────────────────────────────────────────────
    const now = new Date();
    const stats = {
      total:           credits.length,
      actifs:          credits.filter((c) => c.statut === StatutCredit.ACTIF).length,
      enRetard:        credits.filter((c) => c.statut === StatutCredit.EN_RETARD).length,
      soldes:          credits.filter((c) => c.statut === StatutCredit.SOLDE).length,
      enAttente:       credits.filter((c) => c.statut === StatutCredit.EN_ATTENTE_VALIDATION).length,
      montantTotalEmprunte: credits
        .filter((c) => c.statut !== StatutCredit.ANNULE && c.statut !== StatutCredit.REJETE)
        .reduce((s, c) => s + Number(c.montantTotal), 0),
      montantTotalRembourse: credits
        .reduce((s, c) => s + Number(c.montantRembourse), 0),
      soldeRestantTotal: credits
        .filter((c) => c.statut === StatutCredit.ACTIF || c.statut === StatutCredit.EN_RETARD)
        .reduce((s, c) => s + Number(c.soldeRestant), 0),
      echeancesEnRetard: credits.flatMap((c) =>
        c.echeances.filter(
          (e) => e.statut !== "PAYE" && new Date(e.dateEcheance) < now
        )
      ).length,
    };

    return NextResponse.json({ data: credits, stats, client });
  } catch (error) {
    console.error("GET /api/admin/clients/[id]/credits", error);
    return NextResponse.json({ message: "Erreur lors de la récupération des crédits du client" }, { status: 500 });
  }
}
