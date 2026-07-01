import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession, profilRHDansPerimetre } from "@/lib/authRH";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/responsableRH/paie/[id]
 *
 * PATCH /api/responsableRH/paie/[id]
 *   Actions disponibles pour RESPONSABLE_RH :
 *   - SOUMETTRE_CONTROLE : BROUILLON → CONTROLE
 *   - VALIDER            : CONTROLE  → VALIDE  (contrôle RH)
 *   - REFUSER_CONTROLE   : CONTROLE  → BROUILLON
 */

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const fiche  = await prisma.fichePaie.findUnique({
      where: { id: Number(id) },
      include: {
        composants: true,
        profilRH: {
          select: {
            id: true, matricule: true, fonction: true, departement: true, dateEmbauche: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true, photo: true } } } },
          },
        },
      },
    });
    if (!fiche) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });

    // Scoping PDV : un RESPONSABLE_RH ne peut consulter que les fiches de son périmètre.
    if (!(await profilRHDansPerimetre(session, fiche.profilRHId))) {
      return NextResponse.json({ error: "Fiche hors de votre périmètre" }, { status: 403 });
    }

    return NextResponse.json({ data: fiche });
  } catch (error) {
    console.error("GET /api/responsableRH/paie/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id }   = await params;
    const { action } = await req.json();
    const userId   = parseInt(session.user.id);

    if (!action) return NextResponse.json({ error: "action est obligatoire" }, { status: 400 });

    const fiche = await prisma.fichePaie.findUnique({ where: { id: Number(id) } });
    if (!fiche) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });

    // Scoping PDV : un RESPONSABLE_RH ne peut agir que sur les fiches de son périmètre.
    if (!(await profilRHDansPerimetre(session, fiche.profilRHId))) {
      return NextResponse.json({ error: "Fiche hors de votre périmètre" }, { status: 403 });
    }

    type T = { from: string[]; to: string; extra?: Record<string, unknown> };
    const TRANSITIONS: Record<string, T> = {
      SOUMETTRE_CONTROLE: { from: ["BROUILLON"],  to: "CONTROLE" },
      VALIDER:            { from: ["CONTROLE"],   to: "VALIDE",   extra: { valideParId: userId, dateValidation: new Date() } },
      REFUSER_CONTROLE:   { from: ["CONTROLE"],   to: "BROUILLON" },
    };

    const t = TRANSITIONS[action];
    if (!t) return NextResponse.json({ error: "Action non autorisée pour ce rôle" }, { status: 400 });
    if (!t.from.includes(fiche.statut)) {
      return NextResponse.json({ error: `Impossible depuis ${fiche.statut}` }, { status: 422 });
    }

    const updated = await prisma.fichePaie.update({
      where: { id: Number(id) },
      data:  { statut: t.to as never, ...(t.extra ?? {}) },
      include: { composants: true },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action:   "UPDATE",
        entite:   "FichePaie",
        entiteId: updated.id,
        details:  JSON.parse(JSON.stringify({ avant: { statut: fiche.statut }, apres: { statut: t.to }, par: "RESPONSABLE_RH" })),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/responsableRH/paie/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
