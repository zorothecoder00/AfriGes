import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

/**
 * GET /api/admin/ria/recouvrement
 * Stats de recouvrement RIA : encours, retards, taux par portefeuille.
 * Query params : portefeuilleId?, investisseurId?
 */
export async function GET(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const portefeuilleId = searchParams.get("portefeuilleId") ? parseInt(searchParams.get("portefeuilleId")!) : undefined;
    const investisseurId = searchParams.get("investisseurId") ? parseInt(searchParams.get("investisseurId")!) : undefined;

    const now = new Date();
    const seuils = { j3: 3, j7: 7, j15: 15, j30: 30 };

    // Financements actifs ou en retard
    const financements = await prisma.operationFinancementRIA.findMany({
      where: {
        statut: { in: ["ACTIF", "EN_RETARD", "DEFAUT"] },
        ...(portefeuilleId ? { portefeuilleId } : {}),
        ...(investisseurId ? { portefeuille: { profilRIA: { gestionnaire: { memberId: investisseurId } } } } : {}),
      },
      include: {
        portefeuille: {
          select: {
            id: true,
            reference: true,
            nom: true,
            profilRIA: { select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } } },
          },
        },
        affectation: { select: { id: true, classeRisque: true } },
        client: {
          select: {
            id: true, nom: true, prenom: true, telephone: true,
            agentTerrain: { select: { nom: true, prenom: true } },
          },
        },
        creditClient: {
          select: {
            id: true,
            reference: true,
            dateEcheanceFin: true,
            statut: true,
            echeances: {
              where: { statut: { in: ["EN_ATTENTE", "EN_RETARD", "PARTIEL"] } },
              orderBy: { dateEcheance: "asc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { dateEcheance: "asc" },
    });

    // Enrichissement : calcul jours de retard par financement
    const enrichis = financements.map((fin) => {
      const echeanceProchaine = fin.creditClient?.echeances?.[0];
      let joursRetard = 0;
      let niveauAlerte: "AUCUN" | "J3" | "J7" | "J15" | "J30+" = "AUCUN";

      if (echeanceProchaine && echeanceProchaine.dateEcheance < now) {
        joursRetard = Math.floor((now.getTime() - echeanceProchaine.dateEcheance.getTime()) / 86400000);
        if (joursRetard >= seuils.j30) niveauAlerte = "J30+";
        else if (joursRetard >= seuils.j15) niveauAlerte = "J15";
        else if (joursRetard >= seuils.j7) niveauAlerte = "J7";
        else if (joursRetard >= seuils.j3) niveauAlerte = "J3";
      }

      return {
        id: fin.id,
        reference: fin.reference,
        montantFinance: Number(fin.montantFinance),
        montantRembourse: Number(fin.montantRembourse),
        encours: Number(fin.encours),
        statut: fin.statut,
        dateEcheance: fin.dateEcheance,
        joursRetard,
        niveauAlerte,
        portefeuille: {
          id: fin.portefeuille.id,
          reference: fin.portefeuille.reference,
          nom: fin.portefeuille.nom,
          investisseur: fin.portefeuille.profilRIA?.gestionnaire?.member
            ? `${fin.portefeuille.profilRIA.gestionnaire.member.prenom} ${fin.portefeuille.profilRIA.gestionnaire.member.nom}`
            : "—",
        },
        client: {
          id: fin.client.id,
          nom: `${fin.client.prenom} ${fin.client.nom}`,
          telephone: fin.client.telephone,
          agentTerrain: fin.client.agentTerrain
            ? `${fin.client.agentTerrain.prenom} ${fin.client.agentTerrain.nom}`
            : null,
        },
        creditReference: fin.creditClient?.reference ?? null,
        classeRisque: fin.affectation?.classeRisque ?? "A",
      };
    });

    // Agrégats globaux
    const totalEncours    = enrichis.reduce((s, f) => s + f.encours, 0);
    const totalRembourse  = enrichis.reduce((s, f) => s + f.montantRembourse, 0);
    const totalFinance    = enrichis.reduce((s, f) => s + f.montantFinance, 0);
    const tauxRecouvrement = totalFinance > 0 ? (totalRembourse / totalFinance) * 100 : 0;

    const alertes = {
      j3:  enrichis.filter((f) => f.niveauAlerte === "J3").length,
      j7:  enrichis.filter((f) => f.niveauAlerte === "J7").length,
      j15: enrichis.filter((f) => f.niveauAlerte === "J15").length,
      j30: enrichis.filter((f) => f.niveauAlerte === "J30+").length,
    };

    // Stats par portefeuille
    const parPf: Record<number, { reference: string; nom: string | null; investisseur: string; encours: number; rembourse: number; finance: number; enRetard: number }> = {};
    for (const f of enrichis) {
      if (!parPf[f.portefeuille.id]) {
        parPf[f.portefeuille.id] = {
          reference:   f.portefeuille.reference,
          nom:         f.portefeuille.nom,
          investisseur: f.portefeuille.investisseur,
          encours:     0,
          rembourse:   0,
          finance:     0,
          enRetard:    0,
        };
      }
      parPf[f.portefeuille.id].encours   += f.encours;
      parPf[f.portefeuille.id].rembourse += f.montantRembourse;
      parPf[f.portefeuille.id].finance   += f.montantFinance;
      if (f.joursRetard > 0) parPf[f.portefeuille.id].enRetard++;
    }

    const statsParPortefeuille = Object.entries(parPf).map(([id, v]) => ({
      portefeuilleId: parseInt(id),
      ...v,
      tauxRecouvrement: v.finance > 0 ? (v.rembourse / v.finance) * 100 : 0,
    }));

    return NextResponse.json({
      stats: { totalEncours, totalRembourse, totalFinance, tauxRecouvrement, alertes, nbFinancements: enrichis.length },
      statsParPortefeuille,
      financements: enrichis,
    });
  } catch (error) {
    console.error("GET /api/admin/ria/recouvrement", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
