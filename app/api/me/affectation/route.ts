import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { resolveViewAs } from "@/lib/viewAs";

/**
 * GET /api/me/affectation
 * Retourne tous les PDVs actifs de l'utilisateur connecté.
 * - pdvs : liste complète (pour les rôles multi-PDV comme CHEF_AGENCE, RESPONSABLE_COMMUNAUTE)
 * - pdv  : premier PDV (rétrocompat pour les rôles mono-PDV)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const viewAs  = isAdmin ? resolveViewAs(req) : null;
    const userId  = viewAs?.userId ?? parseInt(session.user.id);

    // 1. Toutes les affectations actives (CHEF_AGENCE et RESPONSABLE_COMMUNAUTE peuvent en avoir plusieurs)
    const affs = await prisma.gestionnaireAffectation.findMany({
      where:   { userId, actif: true },
      select:  { pointDeVente: { select: { id: true, nom: true, code: true } } },
      orderBy: { dateDebut: "desc" },
    });

    const pdvs = affs.map((a) => a.pointDeVente).filter(Boolean) as { id: number; nom: string; code: string }[];

    if (pdvs.length > 0) {
      return NextResponse.json({ pdv: pdvs[0], pdvs });
    }

    // 2. Fallback : l'utilisateur est RPV (PointDeVente.rpvId)
    const pdvsRpv = await prisma.pointDeVente.findMany({
      where:  { rpvId: userId, actif: true },
      select: { id: true, nom: true, code: true },
    });

    if (pdvsRpv.length > 0) {
      return NextResponse.json({ pdv: pdvsRpv[0], pdvs: pdvsRpv });
    }

    return NextResponse.json({ pdv: null, pdvs: [] });
  } catch (error) {
    console.error("GET /api/me/affectation:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
