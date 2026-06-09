import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";

/**
 * GET /api/responsableRH/dashboard
 * Tableau de bord du Responsable RH.
 * Les données sont filtrées sur le PDV du RH connecté.
 * Un admin voit tout (aucun filtre PDV).
 */
export async function GET() {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    // ── Résolution du PDV ──────────────────────────────────────────────────────
    let pdvId: number | null = null;
    let pdvNom: string | null = null;

    if (!isAdmin) {
      const affectation = await prisma.gestionnaireAffectation.findFirst({
        where:  { userId, actif: true },
        select: { pointDeVenteId: true, pointDeVente: { select: { nom: true, code: true } } },
      });
      if (affectation) {
        pdvId   = affectation.pointDeVenteId;
        pdvNom  = affectation.pointDeVente.nom;
      }
    }

    // ── Construire le filtre ProfilRH selon PDV ────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let profilFilter: any = {};
    if (pdvId) {
      // Tous les userId affiliés à ce PDV
      const affilies = await prisma.gestionnaireAffectation.findMany({
        where:  { pointDeVenteId: pdvId, actif: true },
        select: { userId: true },
      });
      const userIds = affilies.map((a) => a.userId);
      // Gestionnaires correspondants
      const gestionnaires = await prisma.gestionnaire.findMany({
        where:  { memberId: { in: userIds } },
        select: { id: true },
      });
      const gIds = gestionnaires.map((g) => g.id);
      profilFilter = { gestionnaireId: { in: gIds } };
    }

    // ── Dates utiles ──────────────────────────────────────────────────────────
    const today     = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrow  = new Date(todayDate.getTime() + 86400_000);
    const in30      = new Date(todayDate.getTime() + 30 * 86400_000);

    // 7 derniers jours
    const sept = Array.from({ length: 7 }, (_, i) =>
      new Date(todayDate.getTime() - i * 86400_000)
    ).reverse();
    const weekStart = sept[0];

    const [
      totalCollabs,
      parSexe,
      parDepartement,
      parTypeContrat,
      parStatut,
      pointagesAujourdhui,
      pointagesSemaine,
      postesOuverts,
      postesEnCours,
      candidaturesActives,
      postesRecents,
      evaluationsNotees,
      evaluationsEnCours,
      congesEnAttente,
      cddExpirant,
    ] = await Promise.all([
      // ── Effectif ─────────────────────────────────────────────────────────────
      prisma.profilRH.count({ where: { ...profilFilter, statut: "ACTIF" } }),

      prisma.profilRH.groupBy({
        by:    ["sexe"],
        _count: { id: true },
        where:  { ...profilFilter, statut: "ACTIF" },
      }),

      prisma.profilRH.groupBy({
        by:      ["departement"],
        _count:  { id: true },
        where:   { ...profilFilter, statut: "ACTIF", departement: { not: null } },
        orderBy: { _count: { id: "desc" } },
      }),

      prisma.profilRH.groupBy({
        by:    ["typeContrat"],
        _count: { id: true },
        where:  { ...profilFilter, statut: "ACTIF" },
      }),

      prisma.profilRH.groupBy({
        by:    ["statut"],
        _count: { id: true },
        where:  profilFilter,
      }),

      // ── Présence today ────────────────────────────────────────────────────────
      prisma.pointage.findMany({
        where:  { date: { gte: todayDate, lt: tomorrow }, profilRH: profilFilter },
        select: { statut: true, retardMinutes: true },
      }),

      // ── Tendance 7j ───────────────────────────────────────────────────────────
      prisma.pointage.findMany({
        where:  { date: { gte: weekStart, lt: tomorrow }, profilRH: profilFilter },
        select: { date: true, statut: true },
      }),

      // ── Recrutement (global, pas de filtre PDV) ───────────────────────────────
      prisma.posteOuvert.count({ where: { statut: "OUVERT" } }),
      prisma.posteOuvert.count({ where: { statut: "EN_COURS" } }),
      prisma.candidature.count({
        where: { statut: { in: ["RECU", "PRE_QUALIFICATION", "SHORTLISTE", "ENTRETIEN"] } },
      }),
      prisma.posteOuvert.findMany({
        where:   { statut: { in: ["OUVERT", "EN_COURS"] } },
        orderBy: { createdAt: "desc" },
        take:    5,
        select:  {
          id: true, titre: true, departement: true, statut: true,
          _count: { select: { candidatures: true } },
        },
      }),

      // ── Performance ───────────────────────────────────────────────────────────
      prisma.evaluationRH.findMany({
        where:   {
          noteGlobale: { not: null },
          annee:       { gte: today.getFullYear() - 1 },
          profilRH:    profilFilter,
        },
        select:  {
          id: true, noteGlobale: true, annee: true,
          profilRH: {
            select: {
              id: true, matricule: true,
              gestionnaire: { select: { member: { select: { nom: true, prenom: true, photo: true } } } },
            },
          },
        },
        orderBy: { annee: "desc" },
      }),

      prisma.evaluationRH.count({
        where: { statut: { in: ["EN_COURS", "EVALUATION", "OBJECTIFS_FIXES"] }, profilRH: profilFilter },
      }),

      // ── Congés en attente ─────────────────────────────────────────────────────
      prisma.demandeConge.count({ where: { statut: "EN_ATTENTE", profilRH: profilFilter } }),

      // ── CDD expirant dans 30j ─────────────────────────────────────────────────
      prisma.profilRH.count({
        where: { ...profilFilter, typeContrat: "CDD", statut: "ACTIF", dateFin: { gte: todayDate, lte: in30 } },
      }),
    ]);

    // ── Présence today ────────────────────────────────────────────────────────
    const pPresents     = pointagesAujourdhui.filter((p) => ["PRESENT", "DEMI_JOURNEE"].includes(p.statut)).length;
    const pAbsents      = pointagesAujourdhui.filter((p) => p.statut === "ABSENT").length;
    const pRetards      = pointagesAujourdhui.filter((p) => p.statut === "RETARD").length;
    const pConges       = pointagesAujourdhui.filter((p) => ["CONGE", "MISSION"].includes(p.statut)).length;
    const retardTotal   = pointagesAujourdhui.reduce((s, p) => s + (p.retardMinutes ?? 0), 0);
    const tauxPresence  = totalCollabs > 0 ? Math.round(((pPresents + pRetards) / totalCollabs) * 100) : 0;

    // ── Tendance 7j ───────────────────────────────────────────────────────────
    const tendanceSemaine = sept.map((d) => {
      const key     = d.toISOString().slice(0, 10);
      const dayRows = pointagesSemaine.filter(
        (p) => new Date(p.date).toISOString().slice(0, 10) === key
      );
      return {
        date:     key,
        presents: dayRows.filter((p) => ["PRESENT", "DEMI_JOURNEE", "RETARD"].includes(p.statut)).length,
        absents:  dayRows.filter((p) => p.statut === "ABSENT").length,
        retards:  dayRows.filter((p) => p.statut === "RETARD").length,
      };
    });

    // ── Performance ───────────────────────────────────────────────────────────
    const latestByCollab = new Map<number, typeof evaluationsNotees[0]>();
    for (const ev of evaluationsNotees) {
      const ex = latestByCollab.get(ev.profilRH.id);
      if (!ex || ev.annee > ex.annee) latestByCollab.set(ev.profilRH.id, ev);
    }
    const latest      = Array.from(latestByCollab.values());
    const noteMoyenne = latest.length > 0
      ? Math.round((latest.reduce((s, e) => s + Number(e.noteGlobale), 0) / latest.length) * 10) / 10
      : null;

    const toPerf = (e: typeof latest[0]) => ({
      id:          e.profilRH.id,
      matricule:   e.profilRH.matricule,
      nom:         e.profilRH.gestionnaire.member.nom,
      prenom:      e.profilRH.gestionnaire.member.prenom,
      photo:       e.profilRH.gestionnaire.member.photo,
      noteGlobale: Number(e.noteGlobale),
    });

    const performants  = latest.filter((e) => Number(e.noteGlobale) >= 4)
      .sort((a, b) => Number(b.noteGlobale) - Number(a.noteGlobale)).slice(0, 5).map(toPerf);
    const aAccompagner = latest.filter((e) => Number(e.noteGlobale) < 2.5)
      .sort((a, b) => Number(a.noteGlobale) - Number(b.noteGlobale)).slice(0, 5).map(toPerf);

    return NextResponse.json({
      pdv: pdvId ? { id: pdvId, nom: pdvNom } : null,
      effectif: {
        total:          totalCollabs,
        parSexe:        Object.fromEntries(parSexe.map((s) => [String(s.sexe ?? "NON_RENSEIGNE"), s._count.id])),
        parDepartement: Object.fromEntries(parDepartement.map((d) => [String(d.departement), d._count.id])),
        parTypeContrat: Object.fromEntries(parTypeContrat.map((c) => [String(c.typeContrat ?? "NON_RENSEIGNE"), c._count.id])),
        parStatut:      Object.fromEntries(parStatut.map((s) => [s.statut, s._count.id])),
      },
      presence: {
        date:           todayDate.toISOString().slice(0, 10),
        presents:       pPresents,
        absents:        pAbsents,
        retards:        pRetards,
        conges:         pConges,
        tauxPresence,
        retardTotalMin: retardTotal,
        tendance:       tendanceSemaine,
      },
      recrutement: {
        postesOuverts,
        postesEnCours,
        candidaturesActives,
        postesRecents,
      },
      performance: {
        totalEvaluees:    latest.length,
        noteMoyenne,
        evaluationsEnCours,
        performants,
        aAccompagner,
      },
      alertes: {
        congesEnAttente,
        cddExpirant,
      },
    });
  } catch (error) {
    console.error("GET /api/responsableRH/dashboard", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
