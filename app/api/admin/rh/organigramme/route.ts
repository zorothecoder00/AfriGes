import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/organigramme
 * Retourne l'arbre hiérarchique complet des ProfilRH actifs
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

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
            member: {
              select: {
                id: true, nom: true, prenom: true, photo: true,
                affectationsPDV: {
                  where: { actif: true },
                  select: { pointDeVente: { select: { id: true, nom: true, code: true } } },
                  take: 1,
                },
              },
            },
          },
        },
        _count: { select: { subordonnes: true } },
      },
      orderBy: [{ departement: "asc" }, { fonction: "asc" }],
    });

    // Construire l'arbre
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

    // Stats par PDV (vue géographique)
    const statsPDV = profils.reduce<Record<string, number>>((acc, p) => {
      const pdv = p.gestionnaire?.member?.affectationsPDV?.[0]?.pointDeVente?.nom ?? "Sans PDV";
      acc[pdv] = (acc[pdv] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({ data: roots, flat: profils, statsDept, statsPDV, total: profils.length });
  } catch (error) {
    console.error("GET /api/admin/rh/organigramme", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/rh/organigramme
 * Réaffecte un collaborateur à un nouveau manager
 *
 * Body: { profilRHId, nouveauManagerId (null = retirer le manager), motif? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { profilRHId, nouveauManagerId, motif } = await req.json();

    if (!profilRHId) {
      return NextResponse.json({ error: "profilRHId est obligatoire" }, { status: 400 });
    }

    const profil = await prisma.profilRH.findUnique({
      where: { id: Number(profilRHId) },
      select: {
        id: true, managerId: true, fonction: true, service: true, departement: true,
      },
    });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    // Empêcher d'être son propre manager
    if (nouveauManagerId && Number(nouveauManagerId) === profil.id) {
      return NextResponse.json({ error: "Un collaborateur ne peut pas être son propre manager" }, { status: 400 });
    }

    // Empêcher les cycles hiérarchiques : nouveau manager ne doit pas être un subordonné (direct ou indirect)
    if (nouveauManagerId) {
      const subordonnesIds = await getSubordonnesIds(profil.id);
      if (subordonnesIds.has(Number(nouveauManagerId))) {
        return NextResponse.json({ error: "Cycle hiérarchique détecté : ce collaborateur est déjà subordonné de la cible" }, { status: 400 });
      }
    }

    const [updated] = await prisma.$transaction([
      prisma.profilRH.update({
        where: { id: profil.id },
        data: { managerId: nouveauManagerId ? Number(nouveauManagerId) : null },
      }),
      prisma.historiquePoste.create({
        data: {
          profilRHId:        profil.id,
          ancienManagerId:   profil.managerId,
          ancienneFonction:  profil.fonction,
          ancienService:     profil.service,
          ancienDepartement: profil.departement,
          nouveauManagerId:  nouveauManagerId ? Number(nouveauManagerId) : null,
          nouvelleFonction:  profil.fonction,
          nouveauService:    profil.service,
          nouveauDepartement:profil.departement,
          motif:             motif ?? null,
          modifiePar:        parseInt(session.user.id),
        },
      }),
      prisma.auditLog.create({
        data: {
          userId:   parseInt(session.user.id),
          action:   "UPDATE",
          entite:   "ProfilRH",
          entiteId: profil.id,
          details:  `Réaffectation hiérarchique — nouveau manager: ${nouveauManagerId ?? "aucun"}`,
        },
      }),
    ]);

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/organigramme", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** Retourne tous les IDs subordonnés (récursif) d'un ProfilRH */
async function getSubordonnesIds(profilId: number): Promise<Set<number>> {
  const result = new Set<number>();
  const queue = [profilId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const subs = await prisma.profilRH.findMany({
      where: { managerId: current },
      select: { id: true },
    });
    for (const s of subs) {
      if (!result.has(s.id)) {
        result.add(s.id);
        queue.push(s.id);
      }
    }
  }
  return result;
}
