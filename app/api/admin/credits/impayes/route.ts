import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/credits/impayes
 * Liste complète des crédits clients EN_RETARD, avec le client responsable et
 * le détail de chaque échéance impayée (pour extraction Excel / impression).
 * Contrairement à GET /api/admin/credits, non paginé : usage export/impression
 * uniquement, jamais pour l'affichage courant de la liste.
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const credits = await prisma.creditClient.findMany({
      where: { statut: "EN_RETARD" },
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
          where: { statut: "EN_RETARD" },
          orderBy: { numeroEcheance: "asc" },
          select: { numeroEcheance: true, dateEcheance: true, montantDu: true, montantPaye: true },
        },
      },
      orderBy: { dateEcheanceFin: "asc" },
    });

    const maintenant = Date.now();
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
          Math.floor((maintenant - e.dateEcheance.getTime()) / 86_400_000) - (c.delaiGraceJours ?? 0),
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
