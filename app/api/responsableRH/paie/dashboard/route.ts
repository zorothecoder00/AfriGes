import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";

/**
 * GET /api/responsableRH/paie/dashboard
 * Tableau de bord paie — KPIs masse salariale.
 *   Si admin → toutes les fiches (comme /api/admin/rh/paie/dashboard)
 *   Si RESPONSABLE_RH → uniquement les collaborateurs de son PDV
 * Query: annee? (défaut: année courante)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "");
    const meId    = parseInt(session.user.id);

    const { searchParams } = req.nextUrl;
    const annee = parseInt(searchParams.get("annee") ?? String(new Date().getFullYear()));
    const moisCourant = new Date().getMonth() + 1;

    // ── Périmètre PDV : liste des profilRHId concernés (null = pas de restriction, admin) ──
    let scopedProfilIds: number[] | null = null;
    if (!isAdmin) {
      const affectation = await prisma.gestionnaireAffectation.findFirst({
        where:  { userId: meId, actif: true },
        select: { pointDeVenteId: true },
      });

      if (affectation) {
        const pdvUsers = await prisma.gestionnaireAffectation.findMany({
          where:  { pointDeVenteId: affectation.pointDeVenteId, actif: true },
          select: { userId: true },
        });
        const pdvUserIds = pdvUsers.map((u) => u.userId);
        const profils = await prisma.profilRH.findMany({
          where:  { gestionnaire: { memberId: { in: pdvUserIds } } },
          select: { id: true },
        });
        scopedProfilIds = profils.map((p) => p.id);
      } else {
        // Aucun PDV → restreint aux fiches qu'il a créées / son propre profil
        const profils = await prisma.profilRH.findMany({
          where:  { gestionnaire: { memberId: meId } },
          select: { id: true },
        });
        scopedProfilIds = profils.map((p) => p.id);
      }
    }

    // Filtre profilRHId réutilisable (undefined pour l'admin)
    const profilFilter = scopedProfilIds === null ? undefined : { in: scopedProfilIds };

    const STATUTS_PAIE = ["PAYE", "EN_PAIEMENT", "VALIDE"] as const;

    // ── Masse salariale mensuelle (12 mois de l'année) ─────────────────────────
    const fichesMois = await prisma.fichePaie.groupBy({
      by:     ["mois"],
      where:  { annee, statut: { in: [...STATUTS_PAIE] }, profilRHId: profilFilter },
      _sum:   { netAPayer: true, totalBrut: true, totalRetenues: true },
      orderBy: { mois: "asc" },
    });

    const masseMensuelle = Array.from({ length: 12 }, (_, i) => {
      const m = fichesMois.find((f) => f.mois === i + 1);
      return {
        mois:          i + 1,
        netAPayer:     Number(m?._sum.netAPayer  ?? 0),
        totalBrut:     Number(m?._sum.totalBrut  ?? 0),
        totalRetenues: Number(m?._sum.totalRetenues ?? 0),
      };
    });

    // ── KPIs globaux + jeux de données (année) ────────────────────────────────
    const [totauxAnnee, statuts, avancesEnCours, pretsEnCours, fichesAnnee, affectations] = await Promise.all([
      prisma.fichePaie.aggregate({
        where: { annee, statut: { in: [...STATUTS_PAIE] }, profilRHId: profilFilter },
        _sum:  { netAPayer: true, totalBrut: true, totalRetenues: true },
      }),
      prisma.fichePaie.groupBy({
        by:    ["statut"],
        where: { annee, profilRHId: profilFilter },
        _count: { id: true },
      }),
      prisma.avanceSalaire.aggregate({
        where: { statut: "APPROUVE", profilRHId: profilFilter },
        _sum:  { montantRestant: true },
        _count: { id: true },
      }),
      prisma.pretEmploye.aggregate({
        where: { statut: "EN_COURS", profilRHId: profilFilter },
        _sum:  { montantRestant: true },
        _count: { id: true },
      }),
      prisma.fichePaie.findMany({
        where:  { annee, statut: { in: [...STATUTS_PAIE] }, profilRHId: profilFilter },
        select: {
          mois: true, netAPayer: true, profilRHId: true,
          composants: { select: { type: true, montant: true, isRetenue: true } },
        },
      }),
      prisma.gestionnaireAffectation.findMany({
        where:  { actif: true },
        select: { userId: true, pointDeVente: { select: { nom: true } } },
      }),
    ]);

    // ── Profils concernés (département / équipe / nom) ─────────────────────────
    const profilIds = [...new Set(fichesAnnee.map((f) => f.profilRHId))];
    const profils = await prisma.profilRH.findMany({
      where:  { id: { in: profilIds } },
      select: {
        id: true, departement: true,
        gestionnaire: { select: { memberId: true, member: { select: { nom: true, prenom: true } } } },
      },
    });

    const deptById = new Map<number, string>();
    const userById = new Map<number, number>();
    const nameById = new Map<number, string>();
    for (const p of profils) {
      deptById.set(p.id, p.departement ?? "Non défini");
      userById.set(p.id, p.gestionnaire.memberId);
      nameById.set(p.id, `${p.gestionnaire.member.prenom} ${p.gestionnaire.member.nom}`);
    }
    const pdvByUser = new Map<number, string>();
    for (const a of affectations) {
      if (a.pointDeVente) pdvByUser.set(a.userId, a.pointDeVente.nom);
    }

    // ── Agrégations sur les fiches de l'année ──────────────────────────────────
    const parDepartement:    Record<string, number> = {};
    const parEquipe:         Record<string, number> = {};
    const parCollabMap:      Record<number, number> = {};
    const composantsMoisMap: Record<string, number> = {};
    let commissionsAnnee = 0;
    let bonusAnnee       = 0;
    let primesAnnee      = 0;
    const variablesMensuelles = Array.from({ length: 12 }, (_, i) => ({ mois: i + 1, commissions: 0, bonus: 0, primes: 0 }));

    for (const f of fichesAnnee) {
      const net = Number(f.netAPayer);

      const dept = deptById.get(f.profilRHId) ?? "Non défini";
      parDepartement[dept] = (parDepartement[dept] ?? 0) + net;

      const userId = userById.get(f.profilRHId);
      const pdv    = userId != null ? (pdvByUser.get(userId) ?? "Sans équipe") : "Sans équipe";
      parEquipe[pdv] = (parEquipe[pdv] ?? 0) + net;

      parCollabMap[f.profilRHId] = (parCollabMap[f.profilRHId] ?? 0) + net;

      for (const c of f.composants) {
        const montant = Number(c.montant);
        if (!c.isRetenue && f.mois === moisCourant) {
          composantsMoisMap[c.type] = (composantsMoisMap[c.type] ?? 0) + montant;
        }
        if (c.type === "COMMISSION")      { commissionsAnnee += montant; variablesMensuelles[f.mois - 1].commissions += montant; }
        if (c.type === "BONUS")           { bonusAnnee       += montant; variablesMensuelles[f.mois - 1].bonus       += montant; }
        if (c.type.startsWith("PRIME_"))  { primesAnnee      += montant; variablesMensuelles[f.mois - 1].primes      += montant; }
      }
    }

    const topCollaborateurs = Object.entries(parCollabMap)
      .map(([id, montant]) => ({ nom: nameById.get(Number(id)) ?? `#${id}`, montant }))
      .sort((a, b) => b.montant - a.montant)
      .slice(0, 10);

    const statutsMap = Object.fromEntries(statuts.map((s) => [s.statut, s._count.id]));

    return NextResponse.json({
      data: {
        annee,
        moisCourant,
        masseMensuelle,
        totauxAnnee: {
          netAPayer:     Number(totauxAnnee._sum.netAPayer     ?? 0),
          totalBrut:     Number(totauxAnnee._sum.totalBrut     ?? 0),
          totalRetenues: Number(totauxAnnee._sum.totalRetenues ?? 0),
        },
        statuts:       statutsMap,
        avancesEnCours: {
          count:         avancesEnCours._count.id,
          montantTotal:  Number(avancesEnCours._sum.montantRestant ?? 0),
        },
        pretsEnCours: {
          count:         pretsEnCours._count.id,
          montantTotal:  Number(pretsEnCours._sum.montantRestant ?? 0),
        },
        composantsMoisCourant: composantsMoisMap,
        parDepartement,
        parEquipe,
        topCollaborateurs,
        variables:          { commissions: commissionsAnnee, bonus: bonusAnnee, primes: primesAnnee },
        variablesMensuelles,
      },
    });
  } catch (error) {
    console.error("GET /api/responsableRH/paie/dashboard", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
