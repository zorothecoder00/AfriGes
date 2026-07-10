import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { etatPeremption, SEUIL_PEREMPTION_JOURS } from "@/lib/lotsFefo";
import { marquerLotsPerimes } from "@/lib/lotsFefoServer";

/**
 * Alertes de péremption des lots (Catalogue Ent.#5) — admin.
 * GET ?seuil=30 — lots actifs bientôt périmés ou déjà dépassés, triés FEFO.
 * POST          — balaye et marque PERIME les lots dont la DLC est dépassée.
 */
export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const seuil = Math.min(365, Math.max(1, Number(searchParams.get("seuil")) || SEUIL_PEREMPTION_JOURS));
  const now = new Date();
  const limite = new Date(now.getTime() + seuil * 86400000);

  // Lots actifs avec une DLC ≤ limite (bientôt périmés) ou déjà PERIME.
  const lots = await prisma.lotProduit.findMany({
    where: {
      quantite: { gt: 0 },
      OR: [
        { statut: "ACTIF", dlc: { not: null, lte: limite } },
        { statut: "PERIME" },
      ],
    },
    orderBy: [{ dlc: { sort: "asc", nulls: "last" } }],
    take: 200,
    select: {
      id: true, numeroLot: true, quantite: true, dlc: true, statut: true,
      produit: { select: { id: true, nom: true, codeProduit: true } },
      pointDeVente: { select: { id: true, nom: true } },
    },
  });

  const data = lots.map((l) => ({ ...l, peremption: etatPeremption(l.dlc, seuil, now) }));
  const perimes = data.filter((l) => l.peremption.etat === "PERIME").length;
  const bientot = data.filter((l) => l.peremption.etat === "BIENTOT").length;

  return NextResponse.json({ data: { seuil, resume: { total: data.length, perimes, bientot }, lots: data } });
}

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const traites = await marquerLotsPerimes();
  return NextResponse.json({ data: { traites } });
}
