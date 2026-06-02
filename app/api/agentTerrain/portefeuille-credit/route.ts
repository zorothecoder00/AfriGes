import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";

/**
 * GET /api/agentTerrain/portefeuille-credit
 *
 * Retourne tous les clients du portefeuille de l'agent avec leur profil crédit :
 *  - limiteCredit (plafond fixé par RVC/admin)
 *  - soldeActuel (montant engagé actif)
 *  - creditDisponible = limiteCredit - soldeActuel
 *  - creditsActifs : CreditClients en statut VALIDE/ACTIF (lignes de crédit formelles)
 *
 * Query: ?filtre=tous|avecCredit|disponible|limite_atteinte&search=
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const agentId = parseInt(session.user.id);
    const { searchParams } = new URL(req.url);
    const filtre = searchParams.get("filtre") ?? "tous";
    const search = searchParams.get("search")?.trim() ?? "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      agentTerrainId: agentId,
      etat: { in: ["ACTIF", "EN_ATTENTE_VALIDATION", "SUSPENDU"] },
    };

    if (search) {
      where.OR = [
        { nom:       { contains: search, mode: "insensitive" } },
        { prenom:    { contains: search, mode: "insensitive" } },
        { telephone: { contains: search } },
      ];
    }

    const rawClients = await prisma.client.findMany({
      where,
      select: {
        id: true,
        nom: true,
        prenom: true,
        telephone: true,
        etat: true,
        niveauRisque: true,
        limiteCredit: true,
        soldeActuel: true,
        creditsClients: {
          where: { statut: { in: ["VALIDE", "ACTIF"] } },
          select: {
            id: true,
            reference: true,
            statut: true,
            montantTotal: true,
            montantConsomme: true,
            dateEcheanceFin: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    });

    // Enrichissement + filtre
    const clients = rawClients
      .map((c) => {
        const limite = Number(c.limiteCredit ?? 0);
        const solde  = Number(c.soldeActuel ?? 0);
        const dispo  = Math.max(0, limite - solde);
        return {
          id:               c.id,
          nom:              c.nom,
          prenom:           c.prenom,
          telephone:        c.telephone,
          etat:             c.etat,
          niveauRisque:     c.niveauRisque,
          limiteCredit:     limite > 0 ? limite : null,
          soldeActuel:      solde,
          creditDisponible: dispo,
          creditsActifs:    c.creditsClients.map((cc) => ({
            id:               cc.id,
            reference:        cc.reference,
            statut:           cc.statut,
            montantTotal:     Number(cc.montantTotal),
            montantConsomme:  Number(cc.montantConsomme),
            soldeDisponible:  Number(cc.montantTotal) - Number(cc.montantConsomme),
            dateEcheanceFin:  cc.dateEcheanceFin?.toISOString() ?? null,
          })),
        };
      })
      .filter((c) => {
        if (filtre === "avecCredit")      return c.limiteCredit !== null && c.limiteCredit > 0;
        if (filtre === "disponible")      return c.creditDisponible > 0;
        if (filtre === "limite_atteinte") return c.limiteCredit !== null && c.creditDisponible === 0;
        return true;
      });

    // Stats
    const avecLimite  = clients.filter((c) => c.limiteCredit !== null);
    const stats = {
      totalClients:   clients.length,
      avecCredit:     avecLimite.length,
      totalPlafond:   avecLimite.reduce((s, c) => s + (c.limiteCredit ?? 0), 0),
      totalEngage:    avecLimite.reduce((s, c) => s + c.soldeActuel, 0),
      totalDisponible: avecLimite.reduce((s, c) => s + c.creditDisponible, 0),
      alertes:        avecLimite.filter((c) => c.creditDisponible === 0 && c.soldeActuel > 0).length,
    };

    return NextResponse.json({ clients, stats });
  } catch (error) {
    console.error("GET /api/agentTerrain/portefeuille-credit:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
