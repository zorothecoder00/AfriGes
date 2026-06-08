import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/dashboard
 * Stats consolidées RH pour le tableau de bord
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const currentMois  = today.getMonth() + 1;
    const currentAnnee = today.getFullYear();

    const [
      totalCollab,
      actifsCollab,
      enEssaiCollab,
      suspendusCollab,
      parDeptRaw,

      paieByStatut,
      totalNetMois,

      congesEnAttente,
      congesApprouves,

      missionsEnCours,
      missionsCrees,

      formationsEnCours,
      formationsPlanifiees,

      presentsAujourdhui,
      absentsAujourdhui,
      congesAujourdhui,

      evalsEnCours,
      evalsBrouillon,

      postesOuverts,
      candidaturesEnAttente,

      procOuvertes,
      procEnInstruction,

      rembsEnAttente,
    ] = await Promise.all([
      // Effectifs
      prisma.profilRH.count(),
      prisma.profilRH.count({ where: { statut: "ACTIF" } }),
      prisma.profilRH.count({ where: { statut: "EN_PERIODE_ESSAI" } }),
      prisma.profilRH.count({ where: { statut: "SUSPENDU" } }),
      prisma.profilRH.groupBy({ by: ["departement"], _count: { id: true }, where: { statut: { in: ["ACTIF", "EN_PERIODE_ESSAI"] } } }),

      // Paie
      prisma.fichePaie.groupBy({ by: ["statut"], _count: { id: true }, where: { mois: currentMois, annee: currentAnnee } }),
      prisma.fichePaie.aggregate({ _sum: { netAPayer: true }, where: { statut: "PAYE", mois: currentMois, annee: currentAnnee } }),

      // Congés
      prisma.demandeConge.count({ where: { statut: "EN_ATTENTE" } }),
      prisma.demandeConge.count({ where: { statut: "APPROUVE" } }),

      // Missions
      prisma.mission.count({ where: { statut: "EN_COURS" } }),
      prisma.mission.count({ where: { statut: "CREE" } }),

      // Formations
      prisma.formation.count({ where: { statut: "EN_COURS" } }),
      prisma.formation.count({ where: { statut: "PLANIFIEE" } }),

      // Pointages du jour
      prisma.pointage.count({ where: { date: { gte: today, lt: tomorrow }, statut: "PRESENT" } }),
      prisma.pointage.count({ where: { date: { gte: today, lt: tomorrow }, statut: "ABSENT" } }),
      prisma.pointage.count({ where: { date: { gte: today, lt: tomorrow }, statut: "CONGE" } }),

      // Évaluations
      prisma.evaluationRH.count({ where: { statut: "EN_COURS" } }),
      prisma.evaluationRH.count({ where: { statut: "BROUILLON" } }),

      // Recrutement
      prisma.posteOuvert.count({ where: { statut: "OUVERT" } }),
      prisma.candidature.count({ where: { statut: "RECU" } }),

      // Disciplinaire
      prisma.procedureDisciplinaire.count({ where: { statut: "OUVERTE" } }),
      prisma.procedureDisciplinaire.count({ where: { statut: "EN_INSTRUCTION" } }),

      // Remboursements
      prisma.remboursementFrais.count({ where: { statut: "EN_ATTENTE" } }),
    ]);

    const paieStatutMap = Object.fromEntries(paieByStatut.map((p) => [p.statut, p._count.id]));

    const parDepartement = Object.fromEntries(
      parDeptRaw.map((d) => [d.departement ?? "Non défini", d._count.id])
    );

    return NextResponse.json({
      data: {
        effectifs: {
          total:         totalCollab,
          actifs:        actifsCollab,
          enEssai:       enEssaiCollab,
          suspendus:     suspendusCollab,
          parDepartement,
        },
        paie: {
          brouillons:    paieStatutMap["BROUILLON"] ?? 0,
          valides:       paieStatutMap["VALIDE"]    ?? 0,
          payes:         paieStatutMap["PAYE"]      ?? 0,
          totalNetMois:  totalNetMois._sum.netAPayer ?? 0,
        },
        conges: {
          enAttente:     congesEnAttente,
          approuves:     congesApprouves,
        },
        missions: {
          enCours: missionsEnCours,
          crees:   missionsCrees,
        },
        formations: {
          enCours:    formationsEnCours,
          planifiees: formationsPlanifiees,
        },
        pointages: {
          presentsAujourdhui,
          absentsAujourdhui,
          congesAujourdhui,
        },
        evaluations: {
          enCours:    evalsEnCours,
          brouillons: evalsBrouillon,
        },
        recrutement: {
          postesOuverts,
          candidaturesEnAttente,
        },
        disciplinaire: {
          ouvertes:      procOuvertes,
          enInstruction: procEnInstruction,
        },
        avantages: {
          remboursementsEnAttente: rembsEnAttente,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/admin/rh/dashboard", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
