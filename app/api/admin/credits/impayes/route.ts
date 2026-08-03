import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/credits/impayes
 * Liste complète des crédits clients ayant au moins une échéance impayée en
 * retard, avec le client responsable et le détail de chaque échéance (pour
 * extraction Excel / impression). Contrairement à GET /api/admin/credits, non
 * paginé : usage export/impression uniquement, jamais pour l'affichage courant.
 *
 * Important : le retard est calculé en direct depuis EcheanceCredit.dateEcheance
 * (échéance EN_ATTENTE/PARTIEL dont la date est dépassée), PAS depuis
 * EcheanceCredit.statut === "EN_RETARD" — ce champ n'est jamais mis à jour par un
 * scan quotidien, il ne change qu'en sous-produit d'un remboursement (même
 * constat déjà fait dans lib/alertesSystem.ts pour la même raison : s'y fier ici
 * ne détectait presque jamais rien, alors que CreditClient.statut peut déjà
 * valoir EN_RETARD pendant que ses échéances restent EN_ATTENTE en base).
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const maintenant = new Date();

    const credits = await prisma.creditClient.findMany({
      where: {
        statut: { in: ["ACTIF", "EN_RETARD"] },
        echeances: { some: { statut: { in: ["EN_ATTENTE", "PARTIEL"] }, dateEcheance: { lt: maintenant } } },
      },
      select: {
        id: true,
        reference: true,
        montantTotal: true,
        soldeRestant: true,
        dateDebut: true,
        dateEcheanceFin: true,
        delaiGraceJours: true,
        pointDeVenteId: true,
        client: {
          select: { id: true, nom: true, prenom: true, telephone: true, codeClient: true },
        },
        echeances: {
          where: { statut: { in: ["EN_ATTENTE", "PARTIEL"] }, dateEcheance: { lt: maintenant } },
          orderBy: { numeroEcheance: "asc" },
          select: { numeroEcheance: true, dateEcheance: true, montantDu: true, montantPaye: true },
        },
      },
      orderBy: { dateEcheanceFin: "asc" },
    });

    const data = credits.map((c) => ({
      creditId: c.id,
      reference: c.reference,
      montantTotal: Number(c.montantTotal),
      soldeRestant: Number(c.soldeRestant),
      dateEcheanceFin: c.dateEcheanceFin,
      client: {
        id: c.client.id,
        nom: c.client.nom,
        prenom: c.client.prenom,
        telephone: c.client.telephone,
        codeClient: c.client.codeClient,
      },
      echeancesImpayees: c.echeances.map((e) => {
        const montantRestant = Number(e.montantDu) - Number(e.montantPaye);
        const joursRetard = Math.max(
          0,
          Math.floor((maintenant.getTime() - e.dateEcheance.getTime()) / 86_400_000) - (c.delaiGraceJours ?? 0),
        );
        return {
          numeroEcheance: e.numeroEcheance,
          dateEcheance: e.dateEcheance,
          montantDu: Number(e.montantDu),
          montantPaye: Number(e.montantPaye),
          montantRestant,
          joursRetard,
        };
      }),
    }));

    const totalImpaye = data.reduce(
      (s, c) => s + c.echeancesImpayees.reduce((s2, e) => s2 + e.montantRestant, 0),
      0,
    );

    return NextResponse.json({
      data,
      meta: {
        nbCredits: data.length,
        nbEcheancesImpayees: data.reduce((s, c) => s + c.echeancesImpayees.length, 0),
        totalImpaye,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
