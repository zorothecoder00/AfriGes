import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/me/affectation
 * Retourne le PDV actif de l'utilisateur connecté (via GestionnaireAffectation).
 * Utilisé par le badge UserPdvBadge sur les dashboards gestionnaires.
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const userId = parseInt(session.user.id);

    // 1. Chercher via GestionnaireAffectation (magasinier, agent terrain, caissier, logistique…)
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where:   { userId, actif: true },
      select:  { pointDeVente: { select: { id: true, nom: true, code: true } } },
      orderBy: { dateDebut: "desc" },
    });

    if (aff?.pointDeVente) {
      return NextResponse.json({ pdv: aff.pointDeVente });
    }

    // 2. Fallback : l'utilisateur est RPV (PointDeVente.rpvId)
    const pdvRpv = await prisma.pointDeVente.findFirst({
      where:  { rpvId: userId, actif: true },
      select: { id: true, nom: true, code: true },
    });

    return NextResponse.json({ pdv: pdvRpv ?? null });
  } catch (error) {
    console.error("GET /api/me/affectation:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
