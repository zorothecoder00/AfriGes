import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { TypeCommissionRIA } from "@prisma/client";

const TYPES: TypeCommissionRIA[] = ["FINANCE", "OPERATIONS_TERRAIN", "AUDIT", "OPTIMISATION"];
const LABELS: Record<string, string> = {
  FINANCE:           "Commission Finance",
  OPERATIONS_TERRAIN:"Commission Opérations Terrain",
  AUDIT:             "Commission Audit",
  OPTIMISATION:      "Commission Optimisation",
};

export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const now = new Date();

    const commissions = await Promise.all(
      TYPES.map(async (type) => {
        const [membres, reunions, resolutions, plans] = await Promise.all([
          prisma.membreCommissionRIA.count({ where: { typeCommission: type, actif: true } }),
          prisma.reunionCommissionRIA.findMany({
            where: { typeCommission: type },
            include: { presences: { select: { present: true } } },
          }),
          prisma.resolutionCommRIA.findMany({
            where: { typeCommission: type },
            select: { id: true, statut: true },
          }),
          prisma.planActionCommRIA.findMany({
            where: { typeCommission: type },
            select: { id: true, statut: true, dateEcheance: true, dateTermine: true, createdAt: true },
          }),
        ]);

        const reunionsTenues = reunions.filter(r => r.statut === "TENUE");
        const totalPresences = reunionsTenues.reduce((sum, r) => sum + r.presences.length, 0);
        const presentCount = reunionsTenues.reduce(
          (sum, r) => sum + r.presences.filter(p => p.present).length,
          0
        );
        const tauxPresence = totalPresences > 0 ? (presentCount / totalPresences) * 100 : 0;

        // CDC : une résolution est « actée » une fois adoptée ou exécutée
        // (anciens statuts APPROUVEE/EN_APPLICATION/APPLIQUEE conservés pour données non migrées)
        const resolutionsAdoptees = resolutions.filter(r =>
          ["ADOPTEE", "EXECUTEE", "APPROUVEE", "EN_APPLICATION", "APPLIQUEE"].includes(r.statut)
        ).length;
        const tauxAdoptionResolutions = resolutions.length > 0 ? (resolutionsAdoptees / resolutions.length) * 100 : 0;

        const plansTermines = plans.filter(p => ["TERMINE", "REALISE"].includes(p.statut)).length;
        const tauxExecutionPlans = plans.length > 0 ? (plansTermines / plans.length) * 100 : 0;

        const plansTerminesAvecDate = plans.filter(p =>
          ["TERMINE", "REALISE"].includes(p.statut) && p.dateTermine && p.createdAt
        );
        const tempsMoyenMs = plansTerminesAvecDate.length > 0
          ? plansTerminesAvecDate.reduce((sum, p) =>
              sum + (new Date(p.dateTermine!).getTime() - new Date(p.createdAt).getTime()), 0
            ) / plansTerminesAvecDate.length
          : 0;
        const tempsMoyenExecutionJours = Math.round(tempsMoyenMs / (1000 * 60 * 60 * 24));

        return {
          type,
          label: LABELS[type],
          membresActifs: membres,
          tauxPresence,
          tauxAdoptionResolutions,
          tauxExecutionPlans,
          nbReunionsTenues: reunionsTenues.length,
          nbResolutionsAdoptees: resolutionsAdoptees,
          nbPlansTermines: plansTermines,
          tempsMoyenExecutionJours,
        };
      })
    );

    // Score global = moyenne des 3 taux
    const tauxGouvernanceGlobal = commissions.length > 0
      ? commissions.reduce((sum, c) =>
          sum + (c.tauxPresence + c.tauxAdoptionResolutions + c.tauxExecutionPlans) / 3, 0
        ) / commissions.length
      : 0;

    const [nbAnomaliesResiduelles, nbDossiersClos, rapports] = await Promise.all([
      prisma.anomalieGouvRIA.count({ where: { resolue: false } }),
      prisma.dossierInterCommission.count({ where: { statut: "EXECUTE" } }),
      prisma.rapportCommissionRIA.findMany({ select: { statut: true } }),
    ]);

    const rapportsPublies = rapports.filter(r => r.statut === "VALIDE" || r.statut === "ARCHIVE").length;
    const tauxRapportsPublies = rapports.length > 0 ? (rapportsPublies / rapports.length) * 100 : 0;

    return NextResponse.json({
      commissions,
      tauxGouvernanceGlobal,
      nbAnomaliesResiduelles,
      nbDossiersClos,
      tauxRapportsPublies,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
