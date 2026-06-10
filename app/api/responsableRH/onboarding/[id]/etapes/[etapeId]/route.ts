import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { StatutEtapeOnboarding } from "@prisma/client";

type Ctx = { params: Promise<{ id: string; etapeId: string }> };

/**
 * PATCH /api/responsableRH/onboarding/[id]/etapes/[etapeId]
 * Le RESPONSABLE_RH peut marquer une étape comme FAIT / IGNORE / EN_ATTENTE.
 * Recalcule la progression et clôture automatiquement si 100 %.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, etapeId } = await params;
    const isAdmin         = ["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "");
    const meId            = parseInt(session.user.id);

    const body = await req.json();
    const { statut, commentaire } = body;
    if (!statut) return NextResponse.json({ error: "statut requis" }, { status: 400 });

    const onboarding = await prisma.onboardingEmploye.findUnique({
      where:   { id: Number(id) },
      include: { etapes: true },
    });
    if (!onboarding) return NextResponse.json({ error: "Onboarding introuvable" }, { status: 404 });

    // Vérification scope
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
        const profil = await prisma.profilRH.findFirst({
          where: { id: onboarding.profilRHId, gestionnaire: { memberId: { in: pdvUsers.map((u) => u.userId) } } },
        });
        if (!profil) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    if (onboarding.statut !== "EN_COURS") {
      return NextResponse.json({ error: "L'onboarding n'est pas en cours" }, { status: 422 });
    }

    const etapeUpdated = await prisma.$transaction(async (tx) => {
      const etape = await tx.etapeOnboarding.update({
        where: { id: Number(etapeId), onboardingId: Number(id) },
        data: {
          statut:      statut as StatutEtapeOnboarding,
          dateFaite:   statut === "FAIT"       ? new Date() : statut === "EN_ATTENTE" ? null : undefined,
          commentaire: commentaire !== undefined ? commentaire : undefined,
        },
      });

      const etapes       = await tx.etapeOnboarding.findMany({ where: { onboardingId: Number(id) } });
      const obligatoires = etapes.filter((e) => e.obligatoire);
      const faites       = obligatoires.filter((e) => e.statut === "FAIT");
      const pct          = obligatoires.length > 0 ? Math.round((faites.length / obligatoires.length) * 100) : 0;
      const termine      = pct === 100 && obligatoires.length > 0;

      await tx.onboardingEmploye.update({
        where: { id: Number(id) },
        data: {
          progressionPct: pct,
          ...(termine ? { statut: "TERMINE", dateCloture: new Date() } : {}),
        },
      });

      return etape;
    });

    return NextResponse.json({ data: { etape: etapeUpdated } });
  } catch (error) {
    console.error("PATCH /api/responsableRH/onboarding/[id]/etapes/[etapeId]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
