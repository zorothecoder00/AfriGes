import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import type { ClasseRisqueRIA } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FinSimple {
  statut: string;
  dateEcheance: Date | null;
  encours: number;
  montantFinance: number;
  montantRembourse: number;
}
interface EcheanceSimple { statut: string; dateEcheance: Date; penalite: number }

export interface CriteresDetail {
  historiquePaiement: { nbEcheances: number; nbEnRetard: number; ratio: number };
  retardActif:        { joursMax: number };
  montantsDus:        { tauxRecouvrement: number; totalFinance: number };
  frequenceAchat:     { nbFinancements: number; bonus: boolean };
  anciennete:         { mois: number; bonus: boolean };
  bonusApplique:      boolean;
}

// ── Algorithme de scoring A→E ─────────────────────────────────────────────────
//
// Niveaux :
//  A = Très bon client   — aucun retard, historique sain, fidèle
//  B = Bon client        — retards ponctuels < 7j ou historique léger
//  C = Risque modéré     — retards fréquents ou 7-15j
//  D = Risque élevé      — retards > 15j ou nombreux impayés
//  E = Défaillant        — défaut de paiement ou retard > 30j
//
// Critères pris en compte :
//  1. Historique paiement (ratio écheances en retard)
//  2. Retards actifs (jours de retard sur encours actif)
//  3. Montants dus (taux de recouvrement)
//  4. Fréquence d'achat (nb de financements → bonus si >= 3)
//  5. Ancienneté (mois depuis la première affectation → bonus si >= 6)
//
// Le bonus (fréquence ET ancienneté satisfaits) remonte d'un niveau (sauf E).

function calculerClasse(
  financements: FinSimple[],
  echeances:   EcheanceSimple[],
  dateDebut:   Date,
  now:         Date
): { classe: ClasseRisqueRIA; detail: CriteresDetail } {

  const nbFinancements   = financements.length;
  const ancienneteMois   = Math.max(0, Math.floor(
    (now.getTime() - dateDebut.getTime()) / (30.44 * 24 * 60 * 60 * 1000)
  ));

  const totalFinance   = financements.reduce((s, f) => s + f.montantFinance, 0);
  const totalRembourse = financements.reduce((s, f) => s + f.montantRembourse, 0);
  const tauxRecouvrement = totalFinance > 0 ? (totalRembourse / totalFinance) * 100 : 0;

  // Critère 1 : défaut → E immédiat
  const aDefaut = financements.some((f) => f.statut === "DEFAUT");

  // Critère 2 : retard actif max
  let maxJoursRetardActif = 0;
  for (const f of financements) {
    if (f.statut === "EN_RETARD" && f.dateEcheance) {
      const j = Math.floor((now.getTime() - new Date(f.dateEcheance).getTime()) / 86400000);
      maxJoursRetardActif = Math.max(maxJoursRetardActif, j);
    }
  }

  // Critère 3 : historique paiement (ratio écheances en retard)
  const nbEcheancesTotal    = echeances.length;
  const nbEcheancesEnRetard = echeances.filter(
    (e) => e.statut === "EN_RETARD" || Number(e.penalite) > 0
  ).length;
  const ratioRetards = nbEcheancesTotal > 0 ? nbEcheancesEnRetard / nbEcheancesTotal : 0;

  // Critères 4 & 5 : bonus fréquence + ancienneté
  const bonusFrequence  = nbFinancements >= 3;
  const bonusAnciennete = ancienneteMois >= 6;
  const bonusEligible   = bonusFrequence && bonusAnciennete;

  const CLASSES: ClasseRisqueRIA[] = ["A", "B", "C", "D", "E"];

  function appliquerBonus(c: ClasseRisqueRIA): { classe: ClasseRisqueRIA; bonusApplique: boolean } {
    if (!bonusEligible || c === "E") return { classe: c, bonusApplique: false };
    const idx = CLASSES.indexOf(c);
    if (idx <= 0) return { classe: c, bonusApplique: false };
    return { classe: CLASSES[idx - 1], bonusApplique: true };
  }

  const detail = (classe: ClasseRisqueRIA, bonusApplique: boolean): CriteresDetail => ({
    historiquePaiement: { nbEcheances: nbEcheancesTotal, nbEnRetard: nbEcheancesEnRetard, ratio: parseFloat((ratioRetards * 100).toFixed(1)) },
    retardActif:        { joursMax: maxJoursRetardActif },
    montantsDus:        { tauxRecouvrement: parseFloat(tauxRecouvrement.toFixed(1)), totalFinance },
    frequenceAchat:     { nbFinancements, bonus: bonusFrequence },
    anciennete:         { mois: ancienneteMois, bonus: bonusAnciennete },
    bonusApplique,
  });

  // ── Règles par priorité ───────────────────────────────────────────────────
  if (aDefaut) return { classe: "E", detail: detail("E", false) };
  if (maxJoursRetardActif > 30) return { classe: "E", detail: detail("E", false) };

  if (maxJoursRetardActif > 15) {
    const { classe, bonusApplique } = appliquerBonus("D");
    return { classe, detail: detail(classe, bonusApplique) };
  }
  if (maxJoursRetardActif > 7) {
    const { classe, bonusApplique } = appliquerBonus("C");
    return { classe, detail: detail(classe, bonusApplique) };
  }
  if (maxJoursRetardActif > 0) {
    const { classe, bonusApplique } = appliquerBonus("B");
    return { classe, detail: detail(classe, bonusApplique) };
  }

  // Aucun retard actif → analyse historique
  let baseClasse: ClasseRisqueRIA = "A";
  if (nbEcheancesTotal > 0) {
    if (ratioRetards >= 0.30)      baseClasse = "D";
    else if (ratioRetards >= 0.10) baseClasse = "C";
    else if (ratioRetards > 0)     baseClasse = "B";
    else                           baseClasse = "A";
  }

  // Malus taux de recouvrement très faible (< 20%)
  if (tauxRecouvrement > 0 && tauxRecouvrement < 20 && baseClasse === "A") {
    baseClasse = "B";
  }

  const { classe, bonusApplique } = appliquerBonus(baseClasse);
  return { classe, detail: detail(classe, bonusApplique) };
}

// ── GET : liste des affectations avec scoring enrichi ─────────────────────────

export async function GET(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const portefeuilleId = searchParams.get("portefeuilleId") ? parseInt(searchParams.get("portefeuilleId")!) : undefined;
    const classeFilter   = searchParams.get("classeRisque") as ClasseRisqueRIA | null;
    const actifStr       = searchParams.get("actif");
    const actifFilter    = actifStr === null ? true : actifStr === "true";

    const affectations = await prisma.affectationClientRIA.findMany({
      where: {
        ...(portefeuilleId ? { portefeuilleId } : {}),
        ...(classeFilter   ? { classeRisque: classeFilter } : {}),
        actif: actifFilter,
      },
      include: {
        portefeuille: {
          select: {
            id: true, reference: true, nom: true,
            profilRIA: { select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } } },
          },
        },
        client: {
          select: { id: true, nom: true, prenom: true, telephone: true, niveauRisque: true, scoreSolvabilite: true },
        },
        financements: {
          select: {
            id: true, statut: true,
            montantFinance: true, montantRembourse: true, encours: true,
            dateEcheance: true,
            creditClient: {
              select: {
                echeances: { select: { statut: true, dateEcheance: true, penalite: true } },
              },
            },
          },
        },
      },
      orderBy: [{ classeRisque: "asc" }, { updatedAt: "desc" }],
    });

    const now = new Date();

    const data = affectations.map((aff) => {
      const echeances = aff.financements.flatMap((f) =>
        (f.creditClient?.echeances ?? []).map((e) => ({
          statut:       e.statut,
          dateEcheance: e.dateEcheance,
          penalite:     Number(e.penalite),
        }))
      );
      const finsSimple: FinSimple[] = aff.financements.map((f) => ({
        statut:           f.statut,
        dateEcheance:     f.dateEcheance,
        encours:          Number(f.encours),
        montantFinance:   Number(f.montantFinance),
        montantRembourse: Number(f.montantRembourse),
      }));

      const totalFinance   = finsSimple.reduce((s, f) => s + f.montantFinance, 0);
      const totalRembourse = finsSimple.reduce((s, f) => s + f.montantRembourse, 0);
      const totalEncours   = finsSimple.reduce((s, f) => s + f.encours, 0);

      const { classe: classeCalculee, detail: criteresDetail } = calculerClasse(
        finsSimple, echeances, aff.dateDebut, now
      );

      return {
        id: aff.id,
        portefeuilleId: aff.portefeuilleId,
        portefeuille: {
          reference:   aff.portefeuille.reference,
          nom:         aff.portefeuille.nom,
          investisseur: aff.portefeuille.profilRIA?.gestionnaire?.member
            ? `${aff.portefeuille.profilRIA.gestionnaire.member.prenom} ${aff.portefeuille.profilRIA.gestionnaire.member.nom}`
            : "—",
        },
        client: {
          id:              aff.client.id,
          nom:             `${aff.client.prenom} ${aff.client.nom}`,
          telephone:       aff.client.telephone,
          niveauRisque:    aff.client.niveauRisque,
          scoreSolvabilite: aff.client.scoreSolvabilite !== null ? Number(aff.client.scoreSolvabilite) : null,
        },
        classeRisque:   aff.classeRisque,
        _classeCalculee: classeCalculee,
        criteresDetail,
        pourcentage:    Number(aff.pourcentage),
        montantAlloue:  Number(aff.montantAlloue),
        actif:          aff.actif,
        dateDebut:      aff.dateDebut,
        nbFinancements: aff.financements.length,
        totalFinance,
        totalRembourse,
        totalEncours,
        tauxRecouvrement: totalFinance > 0 ? (totalRembourse / totalFinance) * 100 : 0,
      };
    });

    const repartition: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    for (const d of data) repartition[d.classeRisque] = (repartition[d.classeRisque] ?? 0) + 1;

    return NextResponse.json({ affectations: data, repartition, total: data.length });
  } catch (error) {
    console.error("GET /api/admin/ria/scoring", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ── POST : recalculer et persister les scores ─────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const portefeuilleId = body.portefeuilleId ? parseInt(body.portefeuilleId) : undefined;

    const affectations = await prisma.affectationClientRIA.findMany({
      where: { actif: true, ...(portefeuilleId ? { portefeuilleId } : {}) },
      include: {
        financements: {
          select: {
            statut: true, dateEcheance: true, encours: true,
            montantFinance: true, montantRembourse: true,
            creditClient: {
              select: { echeances: { select: { statut: true, dateEcheance: true, penalite: true } } },
            },
          },
        },
      },
    });

    const now = new Date();
    let nbMaj = 0;

    await prisma.$transaction(async (tx) => {
      for (const aff of affectations) {
        const echeances = aff.financements.flatMap((f) =>
          (f.creditClient?.echeances ?? []).map((e) => ({
            statut:       e.statut,
            dateEcheance: e.dateEcheance,
            penalite:     Number(e.penalite),
          }))
        );
        const finsSimple: FinSimple[] = aff.financements.map((f) => ({
          statut:           f.statut,
          dateEcheance:     f.dateEcheance,
          encours:          Number(f.encours),
          montantFinance:   Number(f.montantFinance),
          montantRembourse: Number(f.montantRembourse),
        }));

        const { classe: nouvelleClasse } = calculerClasse(finsSimple, echeances, aff.dateDebut, now);

        if (nouvelleClasse !== aff.classeRisque) {
          await tx.affectationClientRIA.update({
            where: { id: aff.id },
            data:  { classeRisque: nouvelleClasse },
          });
          nbMaj++;
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `${nbMaj} affectation(s) mise(s) à jour sur ${affectations.length} traitées.`,
      nbMaj,
      nbTotal: affectations.length,
    });
  } catch (error) {
    console.error("POST /api/admin/ria/scoring", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
