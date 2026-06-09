import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeMouvementCarriere } from "@prisma/client";

const INCLUDE_PROFIL = {
  select: {
    id: true, matricule: true, fonction: true, departement: true,
    gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
  },
};

/**
 * GET /api/admin/rh/carrieres/mouvements
 * Tous les mouvements de carrière (toutes profilRH).
 * Query: type?, profilRHId?, departement?, annee?, page?, limit?
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const type       = searchParams.get("type")       as TypeMouvementCarriere | null;
    const profilRHId = searchParams.get("profilRHId");
    const annee      = searchParams.get("annee");
    const page       = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit      = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 30)));
    const skip       = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (type)       where.type       = type;
    if (profilRHId) where.profilRHId = Number(profilRHId);
    if (annee) {
      const y = Number(annee);
      where.createdAt = { gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) };
    }

    const [mouvements, total, statsByType] = await Promise.all([
      prisma.historiquePoste.findMany({
        where,
        skip, take: limit,
        orderBy: { createdAt: "desc" },
        include: { profilRH: INCLUDE_PROFIL },
      }),
      prisma.historiquePoste.count({ where }),
      prisma.historiquePoste.groupBy({ by: ["type"], _count: { id: true }, where: { type: { not: null } } }),
    ]);

    // Résoudre noms managers
    const mgrIds = [...new Set(mouvements.flatMap((h) => [h.ancienManagerId, h.nouveauManagerId].filter(Boolean) as number[]))];
    const mgrs   = mgrIds.length > 0
      ? await prisma.profilRH.findMany({ where: { id: { in: mgrIds } }, select: { id: true, gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } } })
      : [];
    const mgrMap = new Map(mgrs.map((m) => [m.id, m.gestionnaire?.member]));

    const data = mouvements.map((h) => ({
      ...h,
      ancienManager:  h.ancienManagerId  ? (mgrMap.get(h.ancienManagerId)  ?? null) : null,
      nouveauManager: h.nouveauManagerId ? (mgrMap.get(h.nouveauManagerId) ?? null) : null,
    }));

    const stats = Object.fromEntries(statsByType.map((s) => [String(s.type), s._count.id]));

    return NextResponse.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, stats });
  } catch (error) {
    console.error("GET /api/admin/rh/carrieres/mouvements", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/carrieres/mouvements
 * Créer un mouvement de carrière (promotion/mutation/évolution).
 * Body: { profilRHId, type, ancienneFonction?, nouvelleFonction?, ancienDepartement?,
 *         nouveauDepartement?, ancienService?, nouveauService?,
 *         ancienManagerId?, nouveauManagerId?, ancienSalaire?, nouveauSalaire?, motif? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const {
      profilRHId, type,
      ancienneFonction, nouvelleFonction,
      ancienDepartement, nouveauDepartement,
      ancienService, nouveauService,
      ancienManagerId, nouveauManagerId,
      ancienSalaire, nouveauSalaire,
      motif,
    } = body;

    if (!profilRHId || !type) {
      return NextResponse.json({ error: "profilRHId et type sont requis" }, { status: 400 });
    }

    const TYPES: TypeMouvementCarriere[] = ["PROMOTION", "MUTATION", "EVOLUTION", "RECLASSEMENT"];
    if (!TYPES.includes(type as TypeMouvementCarriere)) {
      return NextResponse.json({ error: "type invalide" }, { status: 400 });
    }

    const profil = await prisma.profilRH.findUnique({ where: { id: Number(profilRHId) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    // Créer le mouvement + mettre à jour le profilRH dans une transaction
    const mouvement = await prisma.$transaction(async (tx) => {
      const h = await tx.historiquePoste.create({
        data: {
          profilRHId:        Number(profilRHId),
          type:              type as TypeMouvementCarriere,
          ancienneFonction:  ancienneFonction   ?? profil.fonction   ?? null,
          nouvelleFonction:  nouvelleFonction   ?? null,
          ancienDepartement: ancienDepartement  ?? profil.departement ?? null,
          nouveauDepartement:nouveauDepartement ?? null,
          ancienService:     ancienService      ?? profil.service    ?? null,
          nouveauService:    nouveauService     ?? null,
          ancienManagerId:   ancienManagerId    ? Number(ancienManagerId)  : (profil.managerId ?? null),
          nouveauManagerId:  nouveauManagerId   ? Number(nouveauManagerId) : null,
          ancienSalaire:     ancienSalaire      ? Number(ancienSalaire)  : null,
          nouveauSalaire:    nouveauSalaire     ? Number(nouveauSalaire) : null,
          motif:             motif              ?? null,
          modifiePar:        parseInt(session.user.id),
        },
        include: { profilRH: INCLUDE_PROFIL },
      });

      // Mettre à jour le profil RH si nouvelles valeurs fournies
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = {};
      if (nouvelleFonction)   updates.fonction    = nouvelleFonction;
      if (nouveauDepartement) updates.departement = nouveauDepartement;
      if (nouveauService)     updates.service     = nouveauService;
      if (nouveauManagerId)   updates.managerId   = Number(nouveauManagerId);
      if (Object.keys(updates).length > 0) {
        await tx.profilRH.update({ where: { id: Number(profilRHId) }, data: updates });
      }

      await tx.auditLog.create({
        data: { userId: parseInt(session.user.id), action: "CREATE", entite: "HistoriquePoste", entiteId: h.id,
          details: `${type} créé pour profilRH #${profilRHId}` },
      });

      return h;
    });

    return NextResponse.json({ data: mouvement }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/carrieres/mouvements", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
