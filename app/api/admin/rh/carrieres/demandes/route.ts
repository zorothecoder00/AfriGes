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

const TYPES: TypeMouvementCarriere[] = ["PROMOTION", "MUTATION", "EVOLUTION", "RECLASSEMENT"];

/**
 * GET /api/admin/rh/carrieres/demandes
 * Liste les demandes de mouvement de carrière (promotion/mutation/évolution/reclassement).
 * Query: statut?, profilRHId?, page?, limit?
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut     = searchParams.get("statut");
    const profilRHId = searchParams.get("profilRHId");
    const page        = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit       = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 30)));
    const skip        = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut)     where.statut     = statut;
    if (profilRHId) where.profilRHId = Number(profilRHId);

    const [demandes, total, statsByStatut] = await Promise.all([
      prisma.demandeMouvementCarriere.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: "desc" },
        include: { profilRH: INCLUDE_PROFIL },
      }),
      prisma.demandeMouvementCarriere.count({ where }),
      prisma.demandeMouvementCarriere.groupBy({ by: ["statut"], _count: { id: true } }),
    ]);

    const stats = Object.fromEntries(statsByStatut.map((s) => [s.statut, s._count.id]));

    return NextResponse.json({ data: demandes, meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, stats });
  } catch (error) {
    console.error("GET /api/admin/rh/carrieres/demandes", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/carrieres/demandes
 * Crée une demande de mouvement de carrière, à valider avant écriture dans HistoriquePoste.
 * Body: { profilRHId, type, nouvelleFonction?, nouveauService?, nouveauDepartement?,
 *         nouveauSalaire?, nouveauManagerId?, motif? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const {
      profilRHId, type,
      nouvelleFonction, nouveauService, nouveauDepartement,
      nouveauSalaire, nouveauManagerId, motif,
    } = body;

    if (!profilRHId || !type) {
      return NextResponse.json({ error: "profilRHId et type sont requis" }, { status: 400 });
    }
    if (!TYPES.includes(type as TypeMouvementCarriere)) {
      return NextResponse.json({ error: "type invalide" }, { status: 400 });
    }

    const profil = await prisma.profilRH.findUnique({ where: { id: Number(profilRHId) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    const demande = await prisma.$transaction(async (tx) => {
      const d = await tx.demandeMouvementCarriere.create({
        data: {
          profilRHId:         Number(profilRHId),
          type:               type as TypeMouvementCarriere,
          nouvelleFonction:   nouvelleFonction   ?? null,
          nouveauService:     nouveauService     ?? null,
          nouveauDepartement: nouveauDepartement ?? null,
          nouveauSalaire:     nouveauSalaire      ? Number(nouveauSalaire)     : null,
          nouveauManagerId:   nouveauManagerId    ? Number(nouveauManagerId)   : null,
          motif:              motif ?? null,
          demandeParId:       parseInt(session.user.id),
          statut:             "EN_ATTENTE",
        },
        include: { profilRH: INCLUDE_PROFIL },
      });

      await tx.auditLog.create({
        data: { userId: parseInt(session.user.id), action: "CREATE", entite: "DemandeMouvementCarriere", entiteId: d.id,
          details: `Demande ${type} soumise pour profilRH #${profilRHId}` },
      });

      return d;
    });

    return NextResponse.json({ data: demande }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/carrieres/demandes", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
