import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { creerFichePaie, FichePaieError } from "@/lib/creerFichePaie";

/**
 * POST /api/responsableRH/paie
 * Crée une fiche en BROUILLON pour un collaborateur du PDV du RH.
 * Applique les mêmes automatisations que la route admin (prime d'ancienneté,
 * commissions, absences, retenues prêts/avances) via le helper partagé.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "");
    const body = await req.json();
    const { profilRHId, mois, annee, salaireBase = 0, composants = [], notes } = body;

    if (!profilRHId || !mois || !annee) {
      return NextResponse.json({ error: "profilRHId, mois et annee sont obligatoires" }, { status: 400 });
    }

    // Scoping PDV : un RESPONSABLE_RH ne crée que pour les collaborateurs de son PDV.
    if (!isAdmin) {
      const meId = parseInt(session.user.id);
      const affectation = await prisma.gestionnaireAffectation.findFirst({
        where:  { userId: meId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (affectation) {
        const pdvUsers = await prisma.gestionnaireAffectation.findMany({
          where:  { pointDeVenteId: affectation.pointDeVenteId, actif: true },
          select: { userId: true },
        });
        const pdvUserIds = pdvUsers.map((u) => u.userId);
        const profil = await prisma.profilRH.findFirst({
          where:  { id: Number(profilRHId), gestionnaire: { memberId: { in: pdvUserIds } } },
          select: { id: true },
        });
        if (!profil) return NextResponse.json({ error: "Collaborateur hors de votre périmètre" }, { status: 403 });
      }
    }

    const fiche = await creerFichePaie({
      profilRHId:      Number(profilRHId),
      mois:            Number(mois),
      annee:           Number(annee),
      salaireBase:     Number(salaireBase ?? 0),
      composants,
      notes:           notes ?? null,
      genereParId:     parseInt(session.user.id),
      autoRetenues:    body.autoRetenues    !== false,
      autoCommissions: body.autoCommissions !== false,
      autoDeductions:  body.autoDeductions  !== false,
      autoAnciennete:  body.autoAnciennete  !== false,
    });

    return NextResponse.json({ data: fiche }, { status: 201 });
  } catch (error) {
    if (error instanceof FichePaieError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/responsableRH/paie", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * GET /api/responsableRH/paie
 *   Si admin → toutes les fiches
 *   Si RESPONSABLE_RH → fiches des collaborateurs de son PDV uniquement
 *   Query: mois?, annee?, statut?, page?, limit?
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "");
    const meId    = parseInt(session.user.id);

    const { searchParams } = req.nextUrl;
    const mois   = searchParams.get("mois");
    const annee  = searchParams.get("annee");
    const statut = searchParams.get("statut") ?? undefined;
    const search = searchParams.get("search")?.trim() ?? "";
    const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit  = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const skip   = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (mois)   where.mois   = Number(mois);
    if (annee)  where.annee  = Number(annee);
    if (statut) where.statut = statut;
    if (search) {
      where.profilRH = {
        gestionnaire: {
          member: {
            OR: [
              { nom:    { contains: search, mode: "insensitive" } },
              { prenom: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      };
    }

    // Scoping PDV pour RESPONSABLE_RH
    if (!isAdmin) {
      const affectation = await prisma.gestionnaireAffectation.findFirst({
        where:  { userId: meId, actif: true },
        select: { pointDeVenteId: true },
      });

      if (affectation) {
        const pdvUsers = await prisma.gestionnaireAffectation.findMany({
          where:  { pointDeVenteId: affectation.pointDeVenteId, actif: true },
          select: { userId: true },
        });
        const pdvUserIds = pdvUsers.map((u) => u.userId);

        const profils = await prisma.profilRH.findMany({
          where:  { gestionnaire: { memberId: { in: pdvUserIds } } },
          select: { id: true },
        });
        where.profilRHId = { in: profils.map((p) => p.id) };
      } else {
        // Aucun PDV → restreint aux fiches qu'il a créées
        const profils = await prisma.profilRH.findMany({
          where:  { gestionnaire: { memberId: meId } },
          select: { id: true },
        });
        where.profilRHId = { in: profils.map((p) => p.id) };
      }
    }

    const [fiches, total, statsRaw] = await Promise.all([
      prisma.fichePaie.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ annee: "desc" }, { mois: "desc" }],
        include: {
          composants: true,
          profilRH: {
            select: {
              id: true, matricule: true,
              gestionnaire: { select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } } },
            },
          },
        },
      }),
      prisma.fichePaie.count({ where }),
      prisma.fichePaie.groupBy({ by: ["statut"], where, _count: { id: true } }),
    ]);

    const stats = Object.fromEntries(statsRaw.map((s) => [s.statut, s._count.id]));

    return NextResponse.json({
      data: fiches,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats,
    });
  } catch (error) {
    console.error("GET /api/responsableRH/paie", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
