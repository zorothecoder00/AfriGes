import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuditeurInterneSession } from "@/lib/authAuditeurInterne";

/**
 * GET /api/auditeur/utilisateurs?role=X&search=X&page=1&limit=25
 *
 * Liste des utilisateurs avec leur rôle, PDV affecté et permissions (lecture seule)
 */
export async function GET(req: Request) {
  try {
    const session = await getAuditeurInterneSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit  = Math.min(100, Math.max(5, Number(searchParams.get("limit") ?? "25")));
    const role   = searchParams.get("role") ?? "";
    const search = searchParams.get("search") ?? "";

    // Build Prisma where clause
    const whereRole = role ? { role: role as never } : {};
    const whereMember = search
      ? {
          OR: [
            { nom:    { contains: search, mode: "insensitive" as const } },
            { prenom: { contains: search, mode: "insensitive" as const } },
            { email:  { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const where = {
      ...whereRole,
      ...(search ? { member: whereMember } : {}),
    };

    const [total, gestionnaires] = await Promise.all([
      prisma.gestionnaire.count({ where }),

      prisma.gestionnaire.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: [{ member: { nom: "asc" } }],
        include: {
          member: {
            select: {
              id:          true,
              nom:         true,
              prenom:      true,
              email:       true,
              telephone:   true,
              etat:        true,
              dateAdhesion: true,
              affectationsPDV: {
                where: { actif: true },
                select: {
                  pointDeVente: { select: { id: true, nom: true, code: true, type: true } },
                },
              },
              userPermissions: {
                select: {
                  id:         true,
                  module:     true,
                  permission: true,
                  granted:    true,
                  notes:      true,
                  createdAt:  true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Stats par rôle (global)
    const statsParRole = await prisma.gestionnaire.groupBy({
      by: ["role"],
      _count: { id: true },
    });

    const data = gestionnaires.map((g) => ({
      id:    g.id,
      role:  g.role,
      actif: g.actif,
      membre: {
        id:          g.member.id,
        nom:         g.member.nom,
        prenom:      g.member.prenom,
        email:       g.member.email,
        telephone:   g.member.telephone ?? null,
        etat:        g.member.etat,
        dateAdhesion: g.member.dateAdhesion.toISOString(),
      },
      pdvAffectes: g.member.affectationsPDV.map((a) => ({
        id:   a.pointDeVente.id,
        nom:  a.pointDeVente.nom,
        code: a.pointDeVente.code,
        type: a.pointDeVente.type,
      })),
      permissions: g.member.userPermissions.map((p) => ({
        id:         p.id,
        module:     p.module,
        permission: p.permission,
        granted:    p.granted,
        notes:      p.notes,
        createdAt:  p.createdAt.toISOString(),
      })),
      nbPermissions: g.member.userPermissions.length,
    }));

    return NextResponse.json({
      success: true,
      data,
      statsParRole: Object.fromEntries(statsParRole.map((r) => [r.role, r._count.id])),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/auditeur/utilisateurs error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
