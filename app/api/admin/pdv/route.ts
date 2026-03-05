import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { auditLog } from "@/lib/notifications";

async function getAdminSession() {
  const s = await getAuthSession();
  if (!s) return null;
  if (s.user.role !== "ADMIN" && s.user.role !== "SUPER_ADMIN") return null;
  return s;
}

/**
 * GET /api/admin/pdv
 * Liste tous les points de vente (PDV + dépôts centraux).
 * Query: type (POINT_DE_VENTE | DEPOT_CENTRAL), actif (bool), search, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip   = (page - 1) * limit;
    const search = searchParams.get("search") || "";
    const type   = searchParams.get("type") || "";
    const actifQ = searchParams.get("actif");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (type)   where.type  = type;
    if (actifQ !== null && actifQ !== "") where.actif = actifQ === "true";
    if (search) where.OR = [
      { nom:  { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];

    const [pdvs, total] = await Promise.all([
      prisma.pointDeVente.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nom: "asc" },
        include: {
          rpv:       { select: { id: true, nom: true, prenom: true } },
          chefAgence:{ select: { id: true, nom: true, prenom: true } },
          _count: {
            select: {
              stocks:        true,
              ventesDirectes:true,
              affectations:  true,
            },
          },
        },
      }),
      prisma.pointDeVente.count({ where }),
    ]);

    const [totalPDV, totalDepot, totalActifs] = await Promise.all([
      prisma.pointDeVente.count({ where: { type: "POINT_DE_VENTE" } }),
      prisma.pointDeVente.count({ where: { type: "DEPOT_CENTRAL" } }),
      prisma.pointDeVente.count({ where: { actif: true } }),
    ]);

    return NextResponse.json({
      data:  pdvs,
      stats: { totalPDV, totalDepot, totalActifs },
      meta:  { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /admin/pdv:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/pdv
 * Créer un point de vente ou dépôt central.
 * Body: { code, nom, type?, adresse?, telephone?, notes?, rpvId?, chefAgenceId? }
 */
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { code, nom, type, adresse, telephone, notes, rpvId, chefAgenceId } = body;

    if (!code || !nom) {
      return NextResponse.json({ error: "code et nom sont obligatoires" }, { status: 400 });
    }

    const existing = await prisma.pointDeVente.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: `Le code "${code}" est déjà utilisé` }, { status: 409 });
    }

    // Si rpvId fourni, vérifier qu'il n'est pas déjà RPV d'un autre PDV
    if (rpvId) {
      const dejaPDV = await prisma.pointDeVente.findUnique({ where: { rpvId: Number(rpvId) } });
      if (dejaPDV) {
        return NextResponse.json({ error: "Ce RPV est déjà responsable d'un autre PDV" }, { status: 409 });
      }
    }

    const pdv = await prisma.$transaction(async (tx) => {
      const p = await tx.pointDeVente.create({
        data: {
          code,
          nom,
          type:        type        || "POINT_DE_VENTE",
          adresse:     adresse     || null,
          telephone:   telephone   || null,
          notes:       notes       || null,
          rpvId:       rpvId       ? Number(rpvId)       : null,
          chefAgenceId:chefAgenceId? Number(chefAgenceId): null,
        },
        include: {
          rpv:       { select: { id: true, nom: true, prenom: true } },
          chefAgence:{ select: { id: true, nom: true, prenom: true } },
        },
      });
      await auditLog(tx, parseInt(session.user.id), "PDV_CREE", "PointDeVente", p.id);
      return p;
    });

    return NextResponse.json({ data: pdv }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/pdv:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
