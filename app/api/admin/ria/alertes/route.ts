import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

// ── Seuils par défaut ──────────────────────────────────────────────────────────
const DEFAULTS: Record<string, number> = {
  CAPITAL_FAIBLE_SEUIL:    20,  // % capitalDisponible / capitalInvesti
  RISQUE_ELEVE_SEUIL:      30,  // % affectations classe D ou E
  RENTABILITE_BAISSE_SEUIL: 10, // % de baisse mensuelle
  TAUX_DEFAUT_SEUIL:       10,  // % financements EN_RETARD+DEFAUT / total actifs
  IMPAYES_MONTANT_SEUIL: 1000000, // FCFA
};

async function getConfig(): Promise<Record<string, number>> {
  const rows = await prisma.configAlerteRIA.findMany();
  const cfg = { ...DEFAULTS };
  for (const row of rows) {
    const val = parseFloat(row.valeur);
    if (!isNaN(val)) cfg[row.cle] = val;
  }
  return cfg;
}

export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const cfg   = await getConfig();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ── 1. CLIENTS — Retards ───────────────────────────────────────────────────
    const financementsActifs = await prisma.operationFinancementRIA.findMany({
      where: {
        statut: { in: ["ACTIF", "EN_RETARD"] },
        dateEcheance: { lt: today },
      },
      include: {
        client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        portefeuille: {
          select: {
            id:        true,
            reference: true,
            profilRIA: {
              select: {
                gestionnaire: {
                  select: {
                    member: { select: { nom: true, prenom: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const retards = financementsActifs.map((f) => {
      const echeance    = new Date(f.dateEcheance!);
      const joursRetard = Math.floor((today.getTime() - echeance.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id:             f.id,
        reference:      f.reference,
        clientNom:      `${f.client.prenom} ${f.client.nom}`,
        clientTel:      f.client.telephone,
        portefeuilleRef: f.portefeuille.reference,
        investisseurNom: `${f.portefeuille.profilRIA?.gestionnaire?.member?.prenom ?? ""} ${f.portefeuille.profilRIA?.gestionnaire?.member?.nom ?? ""}`.trim(),
        montantFinance:  Number(f.montantFinance),
        encours:         Number(f.encours),
        dateEcheance:    f.dateEcheance,
        joursRetard,
        statut:          f.statut,
      };
    }).sort((a, b) => b.joursRetard - a.joursRetard);

    const retards3j  = retards.filter((r) => r.joursRetard >= 3  && r.joursRetard < 7);
    const retards7j  = retards.filter((r) => r.joursRetard >= 7  && r.joursRetard < 15);
    const retards15j = retards.filter((r) => r.joursRetard >= 15 && r.joursRetard < 30);
    const retards30j = retards.filter((r) => r.joursRetard >= 30);

    // ── 2. INVESTISSEURS — Capital faible ──────────────────────────────────────
    const portefeuilles = await prisma.portefeuilleRIA.findMany({
      where: { actif: true },
      include: {
        profilRIA: {
          include: {
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        },
      },
    });

    const capitalFaible = portefeuilles
      .filter((pf) => {
        const investi    = Number(pf.capitalInvesti);
        const disponible = Number(pf.capitalDisponible);
        if (investi <= 0) return false;
        return (disponible / investi) * 100 < cfg.CAPITAL_FAIBLE_SEUIL;
      })
      .map((pf) => ({
        id:              pf.id,
        reference:       pf.reference,
        investisseurNom: `${pf.profilRIA?.gestionnaire?.member?.prenom ?? ""} ${pf.profilRIA?.gestionnaire?.member?.nom ?? ""}`.trim(),
        capitalInvesti:  Number(pf.capitalInvesti),
        capitalDisponible: Number(pf.capitalDisponible),
        ratio:           Number(pf.capitalInvesti) > 0
          ? Math.round((Number(pf.capitalDisponible) / Number(pf.capitalInvesti)) * 100)
          : 0,
      }));

    // ── 3. INVESTISSEURS — Portefeuilles à risque (classeRisque D ou E) ────────
    const affectationsRisque = await prisma.affectationClientRIA.findMany({
      where: { actif: true, classeRisque: { in: ["D", "E"] } },
      include: {
        portefeuille: {
          include: {
            profilRIA: {
              include: {
                gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
              },
            },
          },
        },
      },
    });

    // Compter par portefeuille
    const pfRisqueMap: Record<number, { reference: string; investisseurNom: string; nbRisque: number; totalAffectations: number }> = {};
    for (const aff of affectationsRisque) {
      const pfId = aff.portefeuilleId;
      if (!pfRisqueMap[pfId]) {
        pfRisqueMap[pfId] = {
          reference:       aff.portefeuille.reference,
          investisseurNom: `${aff.portefeuille.profilRIA?.gestionnaire?.member?.prenom ?? ""} ${aff.portefeuille.profilRIA?.gestionnaire?.member?.nom ?? ""}`.trim(),
          nbRisque:        0,
          totalAffectations: 0,
        };
      }
      pfRisqueMap[pfId].nbRisque++;
    }

    // Total affectations par portefeuille
    const totalAff = await prisma.affectationClientRIA.groupBy({
      by: ["portefeuilleId"],
      where: { actif: true },
      _count: true,
    });
    for (const g of totalAff) {
      if (pfRisqueMap[g.portefeuilleId]) pfRisqueMap[g.portefeuilleId].totalAffectations = g._count;
    }

    const portefeuillesARisque = Object.entries(pfRisqueMap)
      .map(([pfId, stats]) => ({
        id:              parseInt(pfId),
        ...stats,
        ratioRisque:     stats.totalAffectations > 0
          ? Math.round((stats.nbRisque / stats.totalAffectations) * 100)
          : 0,
      }))
      .filter((p) => p.ratioRisque >= cfg.RISQUE_ELEVE_SEUIL);

    // ── 4. INVESTISSEURS — Rentabilité en baisse ───────────────────────────────
    const now       = new Date();
    const moisCourant = now.getMonth() + 1;
    const anneeCourante = now.getFullYear();
    const moisPrec   = moisCourant === 1 ? 12 : moisCourant - 1;
    const anneePrec  = moisCourant === 1 ? anneeCourante - 1 : anneeCourante;

    const distribCourant = await prisma.distributionBenefice.findMany({
      where: { mois: moisCourant, annee: anneeCourante, statut: { in: ["DISTRIBUE", "REINVESTI"] } },
      select: { portefeuilleId: true, montantDistribue: true, capitalBase: true },
    });
    const distribPrec = await prisma.distributionBenefice.findMany({
      where: { mois: moisPrec, annee: anneePrec, statut: { in: ["DISTRIBUE", "REINVESTI"] } },
      select: { portefeuilleId: true, montantDistribue: true, capitalBase: true },
    });

    const distribPrecMap: Record<number, number> = {};
    for (const d of distribPrec) {
      const taux = Number(d.capitalBase) > 0 ? (Number(d.montantDistribue) / Number(d.capitalBase)) * 100 : 0;
      distribPrecMap[d.portefeuilleId] = taux;
    }

    const rentabiliteBaisse = distribCourant
      .map((d) => {
        const tauxCourant = Number(d.capitalBase) > 0 ? (Number(d.montantDistribue) / Number(d.capitalBase)) * 100 : 0;
        const tauxPrec    = distribPrecMap[d.portefeuilleId] ?? 0;
        const baisse      = tauxPrec > 0 ? ((tauxPrec - tauxCourant) / tauxPrec) * 100 : 0;
        return { portefeuilleId: d.portefeuilleId, tauxCourant, tauxPrec, baisse };
      })
      .filter((d) => d.baisse >= cfg.RENTABILITE_BAISSE_SEUIL);

    // Enrichir avec infos portefeuille
    const pfIds = rentabiliteBaisse.map((d) => d.portefeuilleId);
    const pfInfos = pfIds.length > 0
      ? await prisma.portefeuilleRIA.findMany({
          where: { id: { in: pfIds } },
          include: {
            profilRIA: { include: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } } },
          },
        })
      : [];

    const rentabiliteEnBaisse = rentabiliteBaisse.map((d) => {
      const pf = pfInfos.find((p) => p.id === d.portefeuilleId);
      return {
        ...d,
        reference:       pf?.reference ?? "",
        investisseurNom: `${pf?.profilRIA?.gestionnaire?.member?.prenom ?? ""} ${pf?.profilRIA?.gestionnaire?.member?.nom ?? ""}`.trim(),
      };
    });

    // ── 5. DIRECTION — Impayés critiques ──────────────────────────────────────
    const tousFinancementsProbleme = await prisma.operationFinancementRIA.findMany({
      where: { statut: { in: ["EN_RETARD", "DEFAUT"] } },
      select: { id: true, reference: true, encours: true, statut: true, dateEcheance: true },
    });

    const totalImpayes = tousFinancementsProbleme.reduce((s, f) => s + Number(f.encours), 0);
    const nbDefauts    = tousFinancementsProbleme.filter((f) => f.statut === "DEFAUT").length;

    // Taux de défaut
    const totalActifs  = await prisma.operationFinancementRIA.count({
      where: { statut: { not: "ANNULE" } },
    });
    const nbProblemes  = tousFinancementsProbleme.length;
    const tauxDefaut   = totalActifs > 0 ? (nbProblemes / totalActifs) * 100 : 0;

    const impayes = tousFinancementsProbleme.map((f) => ({
      id:           f.id,
      reference:    f.reference,
      encours:      Number(f.encours),
      statut:       f.statut,
      dateEcheance: f.dateEcheance,
      joursRetard:  f.dateEcheance
        ? Math.floor((today.getTime() - new Date(f.dateEcheance).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    // ── Résumé global ─────────────────────────────────────────────────────────
    const nbAlertesCritiques = retards30j.length + nbDefauts + capitalFaible.filter((p) => p.ratio < 5).length;
    const nbAlertesTotal =
      retards.length +
      capitalFaible.length +
      portefeuillesARisque.length +
      rentabiliteEnBaisse.length +
      (tauxDefaut >= cfg.TAUX_DEFAUT_SEUIL ? 1 : 0) +
      (totalImpayes >= cfg.IMPAYES_MONTANT_SEUIL ? 1 : 0);

    return NextResponse.json({
      resume: {
        nbAlertesCritiques,
        nbAlertesTotal,
        totalImpayes,
        tauxDefaut: parseFloat(tauxDefaut.toFixed(2)),
        totalActifs,
      },
      clients: {
        retards3j,
        retards7j,
        retards15j,
        retards30j,
        totalRetards:   retards.length,
        totalEncoursRisque: retards.reduce((s, r) => s + r.encours, 0),
      },
      investisseurs: {
        capitalFaible,
        portefeuillesARisque,
        rentabiliteEnBaisse,
      },
      direction: {
        impayes,
        totalImpayes,
        nbDefauts,
        tauxDefaut: parseFloat(tauxDefaut.toFixed(2)),
        alerteImpayes: totalImpayes >= cfg.IMPAYES_MONTANT_SEUIL,
        alerteDefaut:  tauxDefaut   >= cfg.TAUX_DEFAUT_SEUIL,
      },
      seuils: cfg,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
