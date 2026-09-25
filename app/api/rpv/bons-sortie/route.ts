import { NextRequest, NextResponse } from "next/server";
import { Prisma, StatutBonSortie } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { resolveViewAs } from "@/lib/viewAs";
import { getSeuilVisaBonSortie } from "@/lib/parametresDocuments";

/**
 * GET /api/rpv/bons-sortie
 * Bons de sortie de l'agence du RPV (supervision + visa au-delà du seuil, CDC §3.4).
 * L'exécution reste au magasinier ; le visa passe par PATCH /api/magasinier/bons-sortie/[id].
 * Query: statut, origine=AGENT_TERRAIN
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const viewAs  = isAdmin ? resolveViewAs(req) : null;
    const effectiveUserId = viewAs?.userId ?? parseInt(session.user.id);

    const pdv = await prisma.pointDeVente.findUnique({
      where: { rpvId: effectiveUserId },
      select: { id: true, nom: true, code: true },
    });
    if (!pdv) return NextResponse.json({ error: "Aucun PDV associé" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const statut  = searchParams.get("statut") ?? "";
    const origine = searchParams.get("origine") ?? "";

    const where: Prisma.BonSortieWhereInput = { pointDeVenteId: pdv.id };
    if (["BROUILLON", "VALIDE", "ANNULE"].includes(statut)) where.statut = statut as StatutBonSortie;
    if (origine === "AGENT_TERRAIN") where.creePar = { gestionnaire: { role: "AGENT_TERRAIN" } };

    const [bons, seuilVisaBonSortie] = await Promise.all([
      prisma.bonSortie.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          creePar:   { select: { id: true, nom: true, prenom: true, gestionnaire: { select: { role: true } } } },
          validePar: { select: { nom: true, prenom: true } },
          visePar:   { select: { nom: true, prenom: true } },
          lignes:    { include: { produit: { select: { id: true, nom: true } } } },
          commandeClient: { select: { reference: true, client: { select: { nom: true, prenom: true } } } },
        },
      }),
      getSeuilVisaBonSortie(),
    ]);

    return NextResponse.json({ data: bons, pdv, seuilVisaBonSortie });
  } catch (error) {
    console.error("GET /api/rpv/bons-sortie", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
