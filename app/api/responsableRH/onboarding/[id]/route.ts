import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/responsableRH/onboarding/[id]
 * Détail d'un onboarding, scopé au PDV du RESPONSABLE_RH.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id }  = await params;
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "");
    const meId    = parseInt(session.user.id);

    const onboarding = await prisma.onboardingEmploye.findUnique({
      where: { id: Number(id) },
      include: {
        profilRH: {
          select: {
            id: true, matricule: true, emailProfessionnel: true,
            fonction: true, service: true, departement: true,
            typeContrat: true, dateEmbauche: true,
            gestionnaire: {
              select: { member: { select: { nom: true, prenom: true, email: true, telephone: true } } },
            },
          },
        },
        candidature: {
          select: {
            id: true, nomCandidat: true, prenomCandidat: true, email: true,
            scoreCandidat: true, dateCandidature: true,
            poste: { select: { id: true, reference: true, titre: true, departement: true, typeContrat: true } },
          },
        },
        template: { select: { id: true, nom: true } },
        etapes:   { orderBy: { ordre: "asc" } },
      },
    });

    if (!onboarding) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

    // Vérification scope RESPONSABLE_RH
    if (!isAdmin) {
      const affectation = await prisma.gestionnaireAffectation.findFirst({
        where: { userId: meId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (affectation) {
        const pdvUsers = await prisma.gestionnaireAffectation.findMany({
          where:  { pointDeVenteId: affectation.pointDeVenteId, actif: true },
          select: { userId: true },
        });
        const profil = await prisma.profilRH.findFirst({
          where: { id: onboarding.profilRHId, gestionnaire: { memberId: { in: pdvUsers.map((u) => u.userId) } } },
        });
        if (!profil) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const now = new Date();
    const etapesFaites       = onboarding.etapes.filter((e) => e.statut === "FAIT").length;
    const etapesObligatoires = onboarding.etapes.filter((e) => e.obligatoire).length;
    const etapesObligFaites  = onboarding.etapes.filter((e) => e.obligatoire && e.statut === "FAIT").length;
    const etapesEnRetard     = onboarding.etapes.filter((e) => e.statut === "EN_ATTENTE" && e.dateLimite && new Date(e.dateLimite) < now).length;
    const progressionPct     = etapesObligatoires > 0 ? Math.round((etapesObligFaites / etapesObligatoires) * 100) : 0;

    return NextResponse.json({
      data: onboarding,
      meta: { totalEtapes: onboarding.etapes.length, etapesFaites, etapesObligatoires, etapesEnRetard, progressionPct },
    });
  } catch (error) {
    console.error("GET /api/responsableRH/onboarding/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
