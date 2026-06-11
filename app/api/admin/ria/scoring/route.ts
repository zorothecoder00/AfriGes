import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import type { ClasseRisqueRIA } from "@prisma/client";

// ── Algorithme de scoring A→E ─────────────────────────────────────────────────
// A = aucun retard, tout honoré à temps
// B = retards ponctuels < 7j
// C = retards fréquents ou entre 7-15j
// D = retards > 15j ou plusieurs impayés partiels
// E = défaut (statut DEFAUT) ou retard > 30j en cours

function calculerClasse(
  financements: { statut: string; dateEcheance: Date | null; encours: number }[],
  echeances: { statut: string; dateEcheance: Date; penalite: number }[],
  now: Date
): ClasseRisqueRIA {
  if (financements.length === 0 && echeances.length === 0) return "A";

  const aDefaut = financements.some((f) => f.statut === "DEFAUT");
  if (aDefaut) return "E";

  // Retard actif le plus long
  let maxJoursRetardActif = 0;
  for (const f of financements) {
    if (f.statut === "EN_RETARD" && f.dateEcheance) {
      const j = Math.floor((now.getTime() - new Date(f.dateEcheance).getTime()) / 86400000);
      maxJoursRetardActif = Math.max(maxJoursRetardActif, j);
    }
  }
  if (maxJoursRetardActif > 30) return "E";
  if (maxJoursRetardActif > 15) return "D";
  if (maxJoursRetardActif > 7)  return "C";
  if (maxJoursRetardActif > 0)  return "B";

  // Analyse historique des échéances
  const total    = echeances.length;
  if (total === 0) return "A";

  const enRetard = echeances.filter(
    (e) => e.statut === "EN_RETARD" || (e.statut !== "EN_ATTENTE" && Number(e.penalite) > 0)
  ).length;

  const ratio = enRetard / total;
  if (ratio === 0)   return "A";
  if (ratio < 0.10)  return "B";
  if (ratio < 0.30)  return "C";
  return "D";
}

// ── GET : liste des affectations avec leur score ──────────────────────────────

/**
 * GET /api/admin/ria/scoring
 * Liste toutes les AffectationClientRIA avec classe calculée + dernière mise à jour.
 * Query params : portefeuilleId?, classeRisque?, actif?
 */
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
            id: true,
            reference: true,
            nom: true,
            profilRIA: { select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } } },
          },
        },
        client: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            telephone: true,
            niveauRisque: true,
            scoreSolvabilite: true,
          },
        },
        financements: {
          select: {
            id: true,
            statut: true,
            montantFinance: true,
            montantRembourse: true,
            encours: true,
            dateEcheance: true,
            creditClient: {
              select: {
                echeances: {
                  select: { statut: true, dateEcheance: true, penalite: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ classeRisque: "asc" }, { updatedAt: "desc" }],
    });

    const data = affectations.map((aff) => {
      const echeances = aff.financements.flatMap((f) =>
        (f.creditClient?.echeances ?? []).map((e) => ({ ...e, penalite: Number(e.penalite) }))
      );
      const finsSimple = aff.financements.map((f) => ({
        statut:      f.statut,
        dateEcheance: f.dateEcheance,
        encours:     Number(f.encours),
      }));

      const totalFinance   = aff.financements.reduce((s, f) => s + Number(f.montantFinance), 0);
      const totalRembourse = aff.financements.reduce((s, f) => s + Number(f.montantRembourse), 0);
      const totalEncours   = aff.financements.reduce((s, f) => s + Number(f.encours), 0);

      return {
        id: aff.id,
        portefeuilleId: aff.portefeuilleId,
        portefeuille: {
          reference: aff.portefeuille.reference,
          nom: aff.portefeuille.nom,
          investisseur: aff.portefeuille.profilRIA?.gestionnaire?.member
            ? `${aff.portefeuille.profilRIA.gestionnaire.member.prenom} ${aff.portefeuille.profilRIA.gestionnaire.member.nom}`
            : "—",
        },
        client: {
          id: aff.client.id,
          nom: `${aff.client.prenom} ${aff.client.nom}`,
          telephone: aff.client.telephone,
          niveauRisque: aff.client.niveauRisque,
          scoreSolvabilite: aff.client.scoreSolvabilite,
        },
        classeRisque: aff.classeRisque,
        pourcentage: Number(aff.pourcentage),
        montantAlloue: Number(aff.montantAlloue),
        actif: aff.actif,
        dateDebut: aff.dateDebut,
        nbFinancements: aff.financements.length,
        totalFinance,
        totalRembourse,
        totalEncours,
        tauxRecouvrement: totalFinance > 0 ? (totalRembourse / totalFinance) * 100 : 0,
        _classeCalculee: calculerClasse(finsSimple, echeances as { statut: string; dateEcheance: Date; penalite: number }[], new Date()),
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

// ── POST : recalculer tous les scores ─────────────────────────────────────────

/**
 * POST /api/admin/ria/scoring
 * Recalcule et persiste la classeRisque de chaque AffectationClientRIA active.
 * Body optionnel : { portefeuilleId?: number } pour cibler un seul portefeuille.
 */
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
            statut: true,
            dateEcheance: true,
            encours: true,
            creditClient: {
              select: {
                echeances: { select: { statut: true, dateEcheance: true, penalite: true } },
              },
            },
          },
        },
      },
    });

    const now = new Date();
    let nbMaj = 0;

    await prisma.$transaction(async (tx) => {
      for (const aff of affectations) {
        const echeances  = aff.financements.flatMap((f) =>
          (f.creditClient?.echeances ?? []).map((e) => ({ ...e, penalite: Number(e.penalite) }))
        );
        const finsSimple = aff.financements.map((f) => ({
          statut:      f.statut,
          dateEcheance: f.dateEcheance,
          encours:     Number(f.encours),
        }));

        const nouvelleClasse = calculerClasse(finsSimple, echeances, now);

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
