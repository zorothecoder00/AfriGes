import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/organigramme
 * Retourne l'arbre hiérarchique complet des ProfilRH actifs
 * Chaque nœud inclut id, matricule, fonction, departement, statut, gestionnaire.member et subordonnes (récursif 3 niveaux)
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    // Récupérer tous les ProfilRH actifs avec leurs relations
    const profils = await prisma.profilRH.findMany({
      where: { statut: { in: ["ACTIF", "EN_PERIODE_ESSAI"] } },
      select: {
        id:                 true,
        matricule:          true,
        fonction:           true,
        service:            true,
        departement:        true,
        niveauHierarchique: true,
        statut:             true,
        managerId:          true,
        gestionnaire: {
          select: {
            id: true,
            member: { select: { id: true, nom: true, prenom: true, photo: true } },
          },
        },
        _count: { select: { subordonnes: true } },
      },
      orderBy: [{ departement: "asc" }, { fonction: "asc" }],
    });

    // Construire l'arbre : racines = ceux sans manager
    type Node = typeof profils[number] & { children: Node[] };
    const map = new Map<number, Node>(profils.map((p) => [p.id, { ...p, children: [] }]));

    const roots: Node[] = [];
    for (const node of map.values()) {
      if (node.managerId && map.has(node.managerId)) {
        map.get(node.managerId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Stats par département
    const statsDept = profils.reduce<Record<string, number>>((acc, p) => {
      const d = p.departement ?? "Non défini";
      acc[d] = (acc[d] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      data:      roots,
      flat:      profils,
      statsDept,
      total:     profils.length,
    });
  } catch (error) {
    console.error("GET /api/admin/rh/organigramme", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
