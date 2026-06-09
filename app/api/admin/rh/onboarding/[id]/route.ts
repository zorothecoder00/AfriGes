import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/rh/onboarding/[id]
 * Détail complet d'un onboarding + checklist des étapes
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;

    const onboarding = await prisma.onboardingEmploye.findUnique({
      where: { id: Number(id) },
      include: {
        profilRH: {
          include: {
            gestionnaire: {
              select: {
                member: { select: { nom: true, prenom: true, email: true, telephone: true } },
              },
            },
          },
        },
        candidature: {
          select: {
            id: true, nomCandidat: true, prenomCandidat: true, email: true,
            cvUrl: true, scoreCandidat: true, dateCandidature: true,
            poste: { select: { id: true, reference: true, titre: true, departement: true, typeContrat: true } },
          },
        },
        template: { select: { id: true, nom: true } },
        etapes:   { orderBy: { ordre: "asc" } },
      },
    });

    if (!onboarding) return NextResponse.json({ error: "Onboarding introuvable" }, { status: 404 });

    // Calcul progression en temps réel
    const total       = onboarding.etapes.length;
    const obligatoires = onboarding.etapes.filter((e) => e.obligatoire);
    const faites       = obligatoires.filter((e) => e.statut === "FAIT");
    const progression  = obligatoires.length > 0
      ? Math.round((faites.length / obligatoires.length) * 100)
      : 0;

    // Étapes en retard
    const now = new Date();
    const enRetard = onboarding.etapes.filter(
      (e) => e.statut === "EN_ATTENTE" && e.dateLimite && e.dateLimite < now
    ).length;

    return NextResponse.json({
      data: onboarding,
      meta: {
        totalEtapes:      total,
        etapesFaites:     faites.length,
        etapesObligatoires: obligatoires.length,
        etapesEnRetard:   enRetard,
        progressionPct:   progression,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/rh/onboarding/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/rh/onboarding/[id]
 * Modifier le statut global ou les notes d'un onboarding
 * Body: { statut?: "SUSPENDU" | "ANNULE" | "TERMINE", notes? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { statut, notes } = body;

    const onboarding = await prisma.onboardingEmploye.findUnique({ where: { id: Number(id) } });
    if (!onboarding) return NextResponse.json({ error: "Onboarding introuvable" }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (notes  !== undefined) data.notes  = notes  ?? null;
    if (statut !== undefined) {
      const transitions: Record<string, string[]> = {
        SUSPENDU: ["EN_COURS"],
        ANNULE:   ["EN_COURS", "SUSPENDU"],
        EN_COURS: ["SUSPENDU"],
        TERMINE:  ["EN_COURS"],
      };
      if (!transitions[statut]?.includes(onboarding.statut)) {
        return NextResponse.json({ error: `Transition ${onboarding.statut} → ${statut} invalide` }, { status: 422 });
      }
      data.statut = statut;
      if (["TERMINE", "ANNULE"].includes(statut)) data.dateCloture = new Date();
    }

    const updated = await prisma.onboardingEmploye.update({ where: { id: Number(id) }, data });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/onboarding/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
