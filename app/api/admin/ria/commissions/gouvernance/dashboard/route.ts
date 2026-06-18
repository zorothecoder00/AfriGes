import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { TypeCommissionRIA } from "@prisma/client";
import { commissionLabel } from "@/lib/commissionsRIA";

const TYPES: TypeCommissionRIA[] = ["FINANCE", "OPERATIONS_TERRAIN", "AUDIT", "OPTIMISATION"];
const PLANS_NON_ACTIFS = ["TERMINE", "REALISE", "ABANDONNE"];

// Tableau de bord DG — vision globale de toutes les commissions.
// Remodèle les groupBy Prisma dans la structure attendue par la page.
export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const now = new Date();
    const userId = parseInt(session.user.id);

    const [
      mesSieges,
      membresGroup,
      reunionsGroup,
      resolutionsGroup,
      plansGroup,
      plansRetardGroup,
      dossiersGroup,
      anomaliesGroup,
      anomaliesTotal,
      rapportsGroup,
      prochaineGlobale,
      prochainesParType,
      dossiersTerm,
    ] = await Promise.all([
      // Sièges réels de l'admin/superadmin connecté (il peut aussi être membre d'une commission)
      prisma.membreCommissionRIA.findMany({
        where: { userId, actif: true },
        select: { typeCommission: true, role: true },
      }),
      prisma.membreCommissionRIA.groupBy({ by: ["typeCommission"], where: { actif: true }, _count: { id: true } }),
      prisma.reunionCommissionRIA.groupBy({ by: ["typeCommission", "statut"], _count: { id: true } }),
      prisma.resolutionCommRIA.groupBy({ by: ["typeCommission", "statut"], _count: { id: true } }),
      prisma.planActionCommRIA.groupBy({ by: ["typeCommission", "statut"], _count: { id: true } }),
      prisma.planActionCommRIA.groupBy({
        by: ["typeCommission"],
        where: { dateEcheance: { lt: now }, statut: { notIn: PLANS_NON_ACTIFS as never } },
        _count: { id: true },
      }),
      prisma.dossierInterCommission.groupBy({ by: ["statut"], _count: { id: true } }),
      prisma.anomalieGouvRIA.groupBy({ by: ["niveau"], where: { resolue: false }, _count: { id: true } }),
      prisma.anomalieGouvRIA.count(),
      prisma.rapportCommissionRIA.groupBy({ by: ["statut"], _count: { id: true } }),
      prisma.reunionCommissionRIA.findFirst({
        where: { statut: "PLANIFIEE", dateHeure: { gte: now } },
        orderBy: { dateHeure: "asc" },
        select: { id: true, titre: true, typeCommission: true, dateHeure: true, lieu: true },
      }),
      prisma.reunionCommissionRIA.findMany({
        where: { statut: "PLANIFIEE", dateHeure: { gte: now } },
        orderBy: { dateHeure: "asc" },
        select: { typeCommission: true, dateHeure: true },
      }),
      prisma.dossierInterCommission.findMany({
        where: { statut: { in: ["APPROUVE", "REJETE", "EN_COURS_EXECUTION", "EXECUTE"] }, dateValidation: { not: null } },
        select: { createdAt: true, dateValidation: true },
      }),
    ]);

    // Helpers de sommation sur les groupBy [typeCommission, statut]
    type Grp = { typeCommission?: TypeCommissionRIA; statut?: string; niveau?: string; _count: { id: number } };
    const sumByType = (arr: Grp[], type: TypeCommissionRIA, statut?: string) =>
      arr.filter((g) => g.typeCommission === type && (statut === undefined || g.statut === statut))
        .reduce((s, g) => s + g._count.id, 0);
    const sumStatut = (arr: Grp[], match: (s: string) => boolean) =>
      arr.filter((g) => match(g.statut ?? "")).reduce((s, g) => s + g._count.id, 0);

    const membresParCommission = TYPES.map((type) => ({
      type,
      label: commissionLabel(type),
      membresActifs: membresGroup.find((g) => g.typeCommission === type)?._count.id ?? 0,
      prochainReunion: prochainesParType.find((r) => r.typeCommission === type)?.dateHeure ?? null,
      reunionsStats: {
        total:  sumByType(reunionsGroup, type),
        tenues: sumByType(reunionsGroup, type, "TENUE"),
      },
      resolutionsStats: {
        total:     sumByType(resolutionsGroup, type),
        adoptees:  sumByType(resolutionsGroup, type, "ADOPTEE"),
        executees: sumByType(resolutionsGroup, type, "EXECUTEE"),
      },
      plansStats: {
        total:    sumByType(plansGroup, type),
        enRetard: plansRetardGroup.find((g) => g.typeCommission === type)?._count.id ?? 0,
      },
    }));

    const tempsMoyen = dossiersTerm.length > 0
      ? Math.round(
          dossiersTerm.reduce((s, d) => s + (new Date(d.dateValidation!).getTime() - new Date(d.createdAt).getTime()) / 86_400_000, 0)
            / dossiersTerm.length
        )
      : 0;

    return NextResponse.json({
      mesCommissions: mesSieges.map((m) => ({
        type: m.typeCommission,
        label: commissionLabel(m.typeCommission),
        role: m.role,
      })),
      membresParCommission,
      reunionsStats: {
        total:      reunionsGroup.reduce((s, g) => s + g._count.id, 0),
        planifiees: sumStatut(reunionsGroup, (s) => s === "PLANIFIEE"),
        tenues:     sumStatut(reunionsGroup, (s) => s === "TENUE"),
        annulees:   sumStatut(reunionsGroup, (s) => s === "ANNULEE"),
      },
      resolutionsStats: {
        total:     resolutionsGroup.reduce((s, g) => s + g._count.id, 0),
        adoptees:  sumStatut(resolutionsGroup, (s) => s === "ADOPTEE"),
        executees: sumStatut(resolutionsGroup, (s) => s === "EXECUTEE"),
        enAttente: sumStatut(resolutionsGroup, (s) => s === "EN_ATTENTE"),
      },
      plansStats: {
        total:     plansGroup.reduce((s, g) => s + g._count.id, 0),
        enRetard:  plansRetardGroup.reduce((s, g) => s + g._count.id, 0),
        termines:  sumStatut(plansGroup, (s) => s === "TERMINE" || s === "REALISE"),
      },
      dossiersStats: {
        total:     dossiersGroup.reduce((s, g) => s + g._count.id, 0),
        enCours:   sumStatut(dossiersGroup, (s) => ["TRANSMIS", "RECU", "EN_ANALYSE"].includes(s)),
        enAttente: sumStatut(dossiersGroup, (s) => s === "EN_ATTENTE_DECISION"),
      },
      anomaliesStats: {
        total:    anomaliesTotal,
        actives:  anomaliesGroup.reduce((s, g) => s + g._count.id, 0),
        critique: anomaliesGroup.find((g) => g.niveau === "CRITIQUE")?._count.id ?? 0,
      },
      rapportsStats: {
        total:   rapportsGroup.reduce((s, g) => s + g._count.id, 0),
        valides: sumStatut(rapportsGroup, (s) => s === "VALIDE"),
      },
      prochainReunion: prochaineGlobale,
      tempsMoyenTraitementJours: tempsMoyen,
      genereLe: now.toISOString(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
