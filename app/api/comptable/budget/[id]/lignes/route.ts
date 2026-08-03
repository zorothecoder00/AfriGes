import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { calculerRealiseCompte } from "@/lib/comptabilite/analytique";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/comptable/budget/[id]/lignes
 * Lignes du budget avec le réalisé et l'écart calculés pour chacune (CDC §25).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const budget = await prisma.budget.findUnique({ where: { id: Number(id) } });
    if (!budget) return NextResponse.json({ error: "Budget introuvable" }, { status: 404 });

    const lignes = await prisma.ligneBudget.findMany({
      where: { budgetId: Number(id) },
      include: {
        compte: { select: { numero: true, libelle: true } },
        sectionAnalytique: { select: { libelle: true, axe: true } },
        pointDeVente: { select: { nom: true } },
      },
      orderBy: [{ mois: "asc" }, { compte: { numero: "asc" } }],
    });

    const enrichies = await Promise.all(
      lignes.map(async (l) => {
        const realise = await calculerRealiseCompte(prisma, {
          compteId: l.compteId,
          annee: budget.annee,
          mois: l.mois,
          sectionAnalytiqueId: l.sectionAnalytiqueId ?? undefined,
          pointDeVenteId: l.pointDeVenteId ?? undefined,
        });
        const prevu = Number(l.montantPrevu);
        return { ...l, montantPrevu: prevu, realise, ecart: prevu - realise };
      }),
    );

    return NextResponse.json({ data: enrichies });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/budget/[id]/lignes
 * Body: { compteId, mois, montantPrevu, sectionAnalytiqueId?, pointDeVenteId? }
 * Crée ou met à jour (même compte+mois+section+PDV) la ligne budgétaire.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const budgetId = Number(id);
    const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
    if (!budget) return NextResponse.json({ error: "Budget introuvable" }, { status: 404 });

    const body = await req.json();
    const { compteId, compteNumero, mois, montantPrevu, sectionAnalytiqueId, pointDeVenteId } = body as {
      compteId?: number; compteNumero?: string; mois?: number; montantPrevu?: number;
      sectionAnalytiqueId?: number; pointDeVenteId?: number;
    };
    if ((!compteId && !compteNumero) || !mois || montantPrevu == null) {
      return NextResponse.json({ error: "compteId (ou compteNumero), mois et montantPrevu sont requis" }, { status: 400 });
    }
    if (mois < 1 || mois > 12) return NextResponse.json({ error: "mois doit être entre 1 et 12" }, { status: 400 });

    let resolvedCompteId = compteId ? Number(compteId) : null;
    if (!resolvedCompteId && compteNumero) {
      const compte = await prisma.compteComptable.findUnique({ where: { numero: compteNumero.trim() }, select: { id: true } });
      if (!compte) return NextResponse.json({ error: `Compte ${compteNumero} introuvable` }, { status: 404 });
      resolvedCompteId = compte.id;
    }

    const existing = await prisma.ligneBudget.findFirst({
      where: {
        budgetId, compteId: resolvedCompteId!, mois: Number(mois),
        sectionAnalytiqueId: sectionAnalytiqueId ? Number(sectionAnalytiqueId) : null,
        pointDeVenteId: pointDeVenteId ? Number(pointDeVenteId) : null,
      },
    });

    const ligne = existing
      ? await prisma.ligneBudget.update({ where: { id: existing.id }, data: { montantPrevu: Number(montantPrevu) } })
      : await prisma.ligneBudget.create({
          data: {
            budgetId, compteId: resolvedCompteId!, mois: Number(mois), montantPrevu: Number(montantPrevu),
            sectionAnalytiqueId: sectionAnalytiqueId ? Number(sectionAnalytiqueId) : null,
            pointDeVenteId: pointDeVenteId ? Number(pointDeVenteId) : null,
          },
        });

    return NextResponse.json({ data: ligne }, { status: existing ? 200 : 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
