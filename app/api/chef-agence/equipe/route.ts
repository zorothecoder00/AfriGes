import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChefAgenceSession, getChefAgencePdvIds } from "@/lib/authChefAgence";

/**
 * GET /api/chef-agence/equipe?pdvId=X&role=X&search=X
 *
 * Tous les agents affectés aux PDVs de la zone, avec leurs performances (30j).
 *
 * POST /api/chef-agence/equipe
 *   Body: { userId, pointDeVenteId }
 *   Affecte un agent terrain (ou autre role) à un PDV de la zone.
 */

export async function GET(req: Request) {
  try {
    const session = await getChefAgenceSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const pdvIds = await getChefAgencePdvIds(session);

    const { searchParams } = new URL(req.url);
    const pdvIdParam = searchParams.get("pdvId") ? Number(searchParams.get("pdvId")) : null;
    const role       = searchParams.get("role")   ?? "";
    const search     = searchParams.get("search") ?? "";

    const effectivePdvIds = pdvIdParam
      ? (pdvIds === null || pdvIds.includes(pdvIdParam) ? [pdvIdParam] : [])
      : pdvIds;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      actif: true,
      ...(effectivePdvIds ? { pointDeVenteId: { in: effectivePdvIds } } : {}),
    };

    if (role) where.user = { ...where.user, gestionnaire: { role } };
    if (search) {
      where.user = {
        ...where.user,
        OR: [
          { nom:    { contains: search, mode: "insensitive" } },
          { prenom: { contains: search, mode: "insensitive" } },
          { email:  { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const affectations = await prisma.gestionnaireAffectation.findMany({
      where,
      include: {
        pointDeVente: { select: { id: true, nom: true, code: true } },
        user: {
          select: {
            id: true, nom: true, prenom: true, email: true,
            telephone: true, etat: true, dateAdhesion: true,
            gestionnaire: { select: { id: true, role: true, actif: true } },
          },
        },
      },
      orderBy: [{ pointDeVente: { nom: "asc" } }, { user: { nom: "asc" } }],
    });

    // ── Performances ventes 30j ───────────────────────────────────────────────
    const depuis30j = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const vendeurIds = affectations
      .filter((a) => ["CAISSIER", "AGENT_TERRAIN", "COMMERCIAL"].includes(a.user.gestionnaire?.role ?? ""))
      .map((a) => a.user.id);

    const [perfVD, perfVP] = await Promise.all([
      vendeurIds.length > 0
        ? prisma.venteDirecte.groupBy({
            by: ["vendeurId"],
            where: {
              vendeurId: { in: vendeurIds },
              statut:    { notIn: ["BROUILLON", "ANNULEE"] },
              createdAt: { gte: depuis30j },
              ...(effectivePdvIds ? { pointDeVenteId: { in: effectivePdvIds } } : {}),
            },
            _sum:   { montantPaye: true },
            _count: { id: true },
          })
        : [],

      vendeurIds.length > 0
        ? prisma.versementPack.groupBy({
            by: ["encaisseParId"],
            where: {
              encaisseParId: { in: vendeurIds },
              datePaiement:  { gte: depuis30j },
            },
            _sum:   { montant: true },
            _count: { id: true },
          })
        : [],
    ]);

    const perfMap: Record<number, { nbVD: number; montantVD: number; nbVP: number; montantVP: number }> = {};
    for (const v of perfVD) {
      if (!v.vendeurId) continue;
      perfMap[v.vendeurId] = { nbVD: v._count.id, montantVD: Number(v._sum.montantPaye ?? 0), nbVP: 0, montantVP: 0 };
    }
    for (const v of perfVP) {
      if (!v.encaisseParId) continue;
      if (!perfMap[v.encaisseParId]) perfMap[v.encaisseParId] = { nbVD: 0, montantVD: 0, nbVP: 0, montantVP: 0 };
      perfMap[v.encaisseParId].nbVP = v._count.id;
      perfMap[v.encaisseParId].montantVP = Number(v._sum.montant ?? 0);
    }

    // Stats par PDV
    const statsPdv: Record<number, { nbAgents: number; parRole: Record<string, number> }> = {};
    for (const a of affectations) {
      if (!statsPdv[a.pointDeVenteId]) statsPdv[a.pointDeVenteId] = { nbAgents: 0, parRole: {} };
      statsPdv[a.pointDeVenteId].nbAgents++;
      const r = a.user.gestionnaire?.role ?? "AUTRE";
      statsPdv[a.pointDeVenteId].parRole[r] = (statsPdv[a.pointDeVenteId].parRole[r] ?? 0) + 1;
    }

    const data = affectations.map((a) => {
      const perf = perfMap[a.user.id] ?? { nbVD: 0, montantVD: 0, nbVP: 0, montantVP: 0 };
      return {
        affectationId: a.id,
        dateDebut:     a.dateDebut.toISOString(),
        pdv:           { id: a.pointDeVente.id, nom: a.pointDeVente.nom, code: a.pointDeVente.code },
        agent: {
          id:          a.user.id,
          nom:         a.user.nom,
          prenom:      a.user.prenom,
          email:       a.user.email,
          telephone:   a.user.telephone,
          etat:        a.user.etat,
          dateAdhesion: a.user.dateAdhesion.toISOString(),
          role:        a.user.gestionnaire?.role ?? "AUTRE",
          actif:       a.user.gestionnaire?.actif ?? false,
        },
        performance: {
          ...perf,
          totalCA: perf.montantVD + perf.montantVP,
          totalOps: perf.nbVD + perf.nbVP,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data,
      stats: {
        total:  data.length,
        actifs: data.filter((d) => d.agent.actif && d.agent.etat === "ACTIF").length,
        statsPdv,
      },
    });
  } catch (error) {
    console.error("GET /api/chef-agence/equipe error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getChefAgenceSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const pdvIds = await getChefAgencePdvIds(session);

    const body = await req.json();
    const { userId, pointDeVenteId, notes } = body;

    if (!userId || !pointDeVenteId) {
      return NextResponse.json({ message: "userId et pointDeVenteId requis" }, { status: 400 });
    }

    // Vérifier que le PDV appartient à la zone du chef d'agence
    if (pdvIds !== null && !pdvIds.includes(Number(pointDeVenteId))) {
      return NextResponse.json({ message: "Ce PDV n'appartient pas à votre zone" }, { status: 403 });
    }

    // Vérifier que l'utilisateur est bien un gestionnaire éligible
    const gestionnaire = await prisma.gestionnaire.findFirst({
      where: { memberId: Number(userId), actif: true },
      select: { id: true, role: true },
    });
    if (!gestionnaire) {
      return NextResponse.json({ message: "Utilisateur non trouvé ou inactif" }, { status: 404 });
    }

    // Désactiver l'affectation active existante pour ce user (si elle existe)
    await prisma.gestionnaireAffectation.updateMany({
      where: { userId: Number(userId), actif: true },
      data:  { actif: false, dateFin: new Date() },
    });

    // Créer la nouvelle affectation
    const affectation = await prisma.gestionnaireAffectation.create({
      data: {
        userId:         Number(userId),
        pointDeVenteId: Number(pointDeVenteId),
        actif:          true,
        notes:          notes ?? null,
      },
      include: {
        user:        { select: { nom: true, prenom: true } },
        pointDeVente: { select: { nom: true, code: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: `${affectation.user.prenom} ${affectation.user.nom} affecté(e) à ${affectation.pointDeVente.nom}`,
      data: { id: affectation.id },
    });
  } catch (error) {
    console.error("POST /api/chef-agence/equipe error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
