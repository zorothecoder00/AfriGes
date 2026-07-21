import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPOPCSession } from "@/lib/popc/authPOPC";
import { planifierLivraisons } from "@/lib/popc/livraisonsServer";

export const runtime = "nodejs";

/**
 * GET /api/popc/livraisons?annee=&mois=&pointDeVenteId=
 * Planification des livraisons de nouveaux crédits (CDC §7).
 */
export async function GET(req: Request) {
  const ctx = await getPOPCSession();
  if (!ctx || !ctx.capacites.consulter) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const annee = Number(searchParams.get("annee")) || now.getFullYear();
  const mois = Number(searchParams.get("mois")) || now.getMonth() + 1;

  let pdv = Number(searchParams.get("pointDeVenteId")) || 0;
  if (ctx.capacites.portee === "agence") {
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: ctx.userId, actif: true }, select: { pointDeVenteId: true },
    });
    pdv = aff?.pointDeVenteId ?? 0;
  }

  const data = await planifierLivraisons(annee, mois, pdv);
  return NextResponse.json({ data });
}
