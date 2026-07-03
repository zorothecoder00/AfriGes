import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { getRHScope } from "@/lib/scopeRH";

/**
 * GET /api/responsableRH/paie/ordres-paiement
 *   Query: mois?, annee?, statut? (défaut: EN_PAIEMENT)
 *   Lecture seule : le RESPONSABLE_RH voit les ordres de paiement de son PDV,
 *   mais le marquage payé reste réservé à l'admin (séparation des tâches).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const scope = await getRHScope(session);

    const { searchParams } = req.nextUrl;
    const mois   = searchParams.get("mois");
    const annee  = searchParams.get("annee");
    const statut = searchParams.get("statut") ?? "EN_PAIEMENT";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { statut };
    if (mois)  where.mois  = Number(mois);
    if (annee) where.annee = Number(annee);
    if (scope.profilRHIds !== null) where.profilRHId = { in: scope.profilRHIds };

    const fiches = await prisma.fichePaie.findMany({
      where,
      orderBy: [{ annee: "desc" }, { mois: "desc" }, { netAPayer: "desc" }],
      select: {
        id: true, mois: true, annee: true, netAPayer: true,
        statut: true, modePaiement: true, notes: true,
        profilRH: {
          select: {
            id: true, matricule: true, departement: true,
            gestionnaire: {
              select: { member: { select: { nom: true, prenom: true, photo: true } } },
            },
          },
        },
      },
    });

    const total = fiches.reduce((s, f) => s + Number(f.netAPayer), 0);

    // Regroupement par mode de paiement (CDC 13.8) + bucket « non affecté ».
    type Groupe = { fiches: typeof fiches; total: number; count: number };
    const listes: Record<"VIREMENT" | "MOBILE_MONEY" | "ESPECES" | "NON_AFFECTE", Groupe> = {
      VIREMENT:     { fiches: [], total: 0, count: 0 },
      MOBILE_MONEY: { fiches: [], total: 0, count: 0 },
      ESPECES:      { fiches: [], total: 0, count: 0 },
      NON_AFFECTE:  { fiches: [], total: 0, count: 0 },
    };
    for (const f of fiches) {
      const k = (["VIREMENT", "MOBILE_MONEY", "ESPECES"] as const).includes(f.modePaiement as never)
        ? (f.modePaiement as "VIREMENT" | "MOBILE_MONEY" | "ESPECES")
        : "NON_AFFECTE";
      listes[k].fiches.push(f);
      listes[k].total += Number(f.netAPayer);
      listes[k].count += 1;
    }

    return NextResponse.json({ data: fiches, total, listes });
  } catch (error) {
    console.error("GET /api/responsableRH/paie/ordres-paiement", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
