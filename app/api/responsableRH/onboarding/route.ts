import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { StatutOnboarding } from "@prisma/client";

/**
 * GET /api/responsableRH/onboarding
 * Admin → tous les onboardings
 * RESPONSABLE_RH → onboardings des collaborateurs de son PDV
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "");
    const meId    = parseInt(session.user.id);

    const { searchParams } = req.nextUrl;
    const statut = searchParams.get("statut") as StatutOnboarding | null;
    const search = searchParams.get("search")?.trim() ?? "";
    const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit  = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const skip   = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
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
    let profilRHIds: number[] | null = null;
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
        const profils = await prisma.profilRH.findMany({
          where:  { gestionnaire: { memberId: { in: pdvUsers.map((u) => u.userId) } } },
          select: { id: true },
        });
        profilRHIds = profils.map((p) => p.id);
      } else {
        const profils = await prisma.profilRH.findMany({
          where:  { gestionnaire: { memberId: meId } },
          select: { id: true },
        });
        profilRHIds = profils.map((p) => p.id);
      }
      where.profilRHId = { in: profilRHIds };
    }

    const statsWhere = profilRHIds !== null ? { profilRHId: { in: profilRHIds } } : {};

    const [onboardings, total, statsRaw] = await Promise.all([
      prisma.onboardingEmploye.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          profilRH: {
            select: {
              id: true, matricule: true, emailProfessionnel: true,
              fonction: true, departement: true,
              gestionnaire: {
                select: { member: { select: { nom: true, prenom: true, telephone: true } } },
              },
            },
          },
          candidature: {
            select: {
              id: true, nomCandidat: true, prenomCandidat: true,
              poste: { select: { id: true, reference: true, titre: true } },
            },
          },
          template: { select: { id: true, nom: true } },
          _count:   { select: { etapes: true } },
        },
      }),
      prisma.onboardingEmploye.count({ where }),
      prisma.onboardingEmploye.groupBy({
        by:    ["statut"],
        where: statsWhere,
        _count: { id: true },
      }),
    ]);

    const stats = Object.fromEntries(statsRaw.map((s) => [s.statut, s._count.id]));

    return NextResponse.json({
      data: onboardings,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats,
    });
  } catch (error) {
    console.error("GET /api/responsableRH/onboarding", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
