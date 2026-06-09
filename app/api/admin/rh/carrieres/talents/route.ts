import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/carrieres/talents
 * Collaborateurs identifiés comme talents clés (estTalentCle = true).
 * Dédupliqués : si un collab est talent clé sur plusieurs postes, il n'apparaît qu'une fois.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const departement = searchParams.get("departement")?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { estTalentCle: true };
    if (departement) where.profilRH = { departement: { contains: departement, mode: "insensitive" } };

    const rows = await prisma.successeurPotentiel.findMany({
      where,
      include: {
        profilRH: {
          select: {
            id: true, matricule: true, fonction: true, departement: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true, photo: true } } } },
            planCarriere: { select: { prochainPosteVise: true, dateRevision: true } },
            competences:  { select: { niveau: true, competence: { select: { nom: true, type: true } } }, take: 5 },
          },
        },
        posteCritique: { select: { id: true, titre: true, departement: true } },
      },
      orderBy: { readiness: "asc" },
    });

    // Dédupliquer par profilRHId mais garder tous les postes critiques
    const talentsMap = new Map<number, {
      profilRH:   (typeof rows)[0]["profilRH"];
      readiness:  string;
      notes:      string | null;
      postes:     { id: number; titre: string; departement: string | null }[];
    }>();

    for (const row of rows) {
      const existing = talentsMap.get(row.profilRHId);
      if (existing) {
        existing.postes.push(row.posteCritique);
        // Prendre la meilleure readiness
        const order = ["PRET_MAINTENANT","PRET_SOUS_1_AN","PRET_1_A_3_ANS","EN_DEVELOPPEMENT"];
        if (order.indexOf(row.readiness) < order.indexOf(existing.readiness)) {
          existing.readiness = row.readiness;
        }
      } else {
        talentsMap.set(row.profilRHId, {
          profilRH:  row.profilRH,
          readiness: row.readiness,
          notes:     row.notes,
          postes:    [row.posteCritique],
        });
      }
    }

    const talents = Array.from(talentsMap.values());
    return NextResponse.json({ data: talents, total: talents.length });
  } catch (error) {
    console.error("GET /api/admin/rh/carrieres/talents", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
