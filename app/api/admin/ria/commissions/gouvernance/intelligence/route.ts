import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

// Centre d'Intelligence Décisionnelle — agrège les signaux critiques.
// La réponse est mise en forme pour correspondre exactement aux champs rendus
// par la page (objets plats, pas de structures imbriquées).
export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const now = new Date();
    const il30jours = new Date(now.getTime() - 30 * 86_400_000);
    const joursDepuis = (d: Date | string | null) =>
      d ? Math.max(0, Math.floor((now.getTime() - new Date(d).getTime()) / 86_400_000)) : 0;

    const [
      anomalies,
      portefeuilles,
      financementsRetard,
      dossiers,
      plans,
      reunions,
      agencesGroup,
      financementsRegion,
    ] = await Promise.all([
      prisma.anomalieGouvRIA.findMany({
        where: { resolue: false, niveau: { in: ["CRITIQUE", "MAJEURE"] } },
        orderBy: [{ niveau: "asc" }, { createdAt: "desc" }],
        take: 20,
        select: { id: true, titre: true, niveau: true, typeCommission: true, createdAt: true },
      }),
      prisma.portefeuilleRIA.findMany({
        where: { actif: true },
        select: {
          id: true, reference: true, capitalInvesti: true, capitalDisponible: true,
          profilRIA: { select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } } },
        },
      }),
      prisma.operationFinancementRIA.findMany({
        where: { statut: "EN_RETARD" },
        select: { id: true, encours: true, dateEcheance: true, client: { select: { nom: true, prenom: true } } },
        orderBy: { encours: "desc" },
        take: 20,
      }),
      prisma.dossierInterCommission.findMany({
        where: { statut: { in: ["EN_ANALYSE", "EN_ATTENTE_DECISION", "RECU"] } },
        select: { id: true, reference: true, titre: true, commissionReceptrice: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
      prisma.planActionCommRIA.findMany({
        where: { statut: { notIn: ["TERMINE", "REALISE", "ABANDONNE"] }, dateEcheance: { lt: now } },
        select: {
          id: true, titre: true, typeCommission: true, dateEcheance: true,
          responsable: { select: { nom: true, prenom: true } },
        },
        orderBy: { dateEcheance: "asc" },
        take: 20,
      }),
      prisma.reunionCommissionRIA.findMany({
        where: { statut: "PLANIFIEE", dateHeure: { gte: now } },
        select: { id: true, titre: true, typeCommission: true, dateHeure: true },
        orderBy: { dateHeure: "asc" },
        take: 5,
      }),
      prisma.operationFinancementRIA.groupBy({
        by: ["clientId"],
        where: { createdAt: { gte: il30jours } },
        _sum: { montantRembourse: true, montantFinance: true },
      }),
      prisma.operationFinancementRIA.findMany({
        where: { statut: { in: ["ACTIF", "REMBOURSE"] } },
        select: { montantFinance: true, montantRembourse: true, client: { select: { ville: true } } },
      }),
    ]);

    // Portefeuilles en danger : capital disponible < 10% du capital investi
    const portefeillesEnDanger = portefeuilles
      .map((pf) => {
        const investi = Number(pf.capitalInvesti);
        const dispo = Number(pf.capitalDisponible);
        const pct = investi > 0 ? (dispo / investi) * 100 : 100;
        const m = pf.profilRIA?.gestionnaire?.member;
        return {
          id: pf.id,
          reference: pf.reference,
          investisseur: m ? `${m.prenom} ${m.nom}` : "—",
          risque: pct < 5 ? "Critique" : "Élevé",
          capitalDisponible: dispo,
          _pct: pct,
        };
      })
      .filter((p) => p._pct < 10)
      .map(({ _pct, ...p }) => p);

    const clientsDefaillants = financementsRetard.map((f) => ({
      id: f.id,
      nom: f.client?.nom ?? "",
      prenom: f.client?.prenom ?? "",
      montantDu: Number(f.encours),
      joursRetard: joursDepuis(f.dateEcheance),
    }));

    const dossiersEnAttente = dossiers.map((d) => ({
      id: d.id,
      reference: d.reference,
      titre: d.titre,
      commissionReceptrice: d.commissionReceptrice,
      joursEnAttente: joursDepuis(d.createdAt),
    }));

    const plansEnRetard = plans.map((p) => ({
      id: p.id,
      titre: p.titre,
      typeCommission: p.typeCommission,
      dateEcheance: p.dateEcheance,
      responsable: p.responsable ? `${p.responsable.prenom} ${p.responsable.nom}` : null,
    }));

    // Agences (clients) sous-performantes : taux de recouvrement < 50% sur 30j
    const sousPerf = agencesGroup
      .map((g) => ({
        clientId: g.clientId,
        finance: Number(g._sum.montantFinance ?? 0),
        rembourse: Number(g._sum.montantRembourse ?? 0),
      }))
      .filter((g) => g.finance > 0 && g.rembourse / g.finance < 0.5)
      .slice(0, 10);
    const clientsAgences = sousPerf.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: sousPerf.map((s) => s.clientId) } },
          select: { id: true, nom: true, prenom: true, pointDeVente: { select: { nom: true } } },
        })
      : [];
    const agencesSousPerformantes = sousPerf.map((s) => {
      const c = clientsAgences.find((x) => x.id === s.clientId);
      return {
        id: s.clientId,
        nom: c?.pointDeVente?.nom ?? (c ? `${c.prenom} ${c.nom}` : `Client #${s.clientId}`),
        tauxRecouvrement: (s.rembourse / s.finance) * 100,
        objectif: 50,
      };
    });

    // Régions les plus rentables (par ville)
    const regionMap: Record<string, { finance: number; rembourse: number }> = {};
    for (const f of financementsRegion) {
      const ville = f.client?.ville ?? "Non renseigné";
      if (!regionMap[ville]) regionMap[ville] = { finance: 0, rembourse: 0 };
      regionMap[ville].finance += Number(f.montantFinance);
      regionMap[ville].rembourse += Number(f.montantRembourse);
    }
    const regionsRentables = Object.entries(regionMap)
      .filter(([, v]) => v.finance > 0)
      .map(([region, v]) => ({ region, rendement: (v.rembourse / v.finance) * 100, volume: v.finance }))
      .sort((a, b) => b.rendement - a.rendement)
      .slice(0, 5);

    return NextResponse.json({
      anomaliesActives: anomalies,
      portefeillesEnDanger,
      clientsDefaillants,
      dossiersEnAttente,
      plansEnRetard,
      reunionsPlanifiees: reunions,
      agencesSousPerformantes,
      regionsRentables,
      genereLe: now.toISOString(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
