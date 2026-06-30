import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { NiveauReadiness } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

const READINESS_VALS: NiveauReadiness[] = ["PRET_MAINTENANT", "PRET_SOUS_1_AN", "PRET_1_A_3_ANS", "EN_DEVELOPPEMENT"];

/**
 * GET /api/admin/rh/carrieres/plan-succession/[id]/successeurs
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const poste = await prisma.posteCritique.findUnique({ where: { id: Number(id) } });
    if (!poste) return NextResponse.json({ error: "Poste critique introuvable" }, { status: 404 });

    const successeurs = await prisma.successeurPotentiel.findMany({
      where: { posteCritiqueId: Number(id), actif: true },
      include: {
        profilRH: {
          select: {
            id: true, matricule: true, fonction: true, departement: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        },
      },
      orderBy: { readiness: "asc" },
    });

    return NextResponse.json({ data: successeurs });
  } catch (error) {
    console.error("GET /api/admin/rh/carrieres/plan-succession/[id]/successeurs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/carrieres/plan-succession/[id]/successeurs
 * Ajouter ou mettre à jour un successeur.
 * Body: { profilRHId, readiness, estTalentCle?, notes? }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { profilRHId, readiness, estTalentCle, notes } = body;

    if (!profilRHId || !readiness) {
      return NextResponse.json({ error: "profilRHId et readiness sont requis" }, { status: 400 });
    }
    if (!READINESS_VALS.includes(readiness as NiveauReadiness)) {
      return NextResponse.json({ error: "readiness invalide" }, { status: 400 });
    }

    const poste  = await prisma.posteCritique.findUnique({ where: { id: Number(id) } });
    if (!poste) return NextResponse.json({ error: "Poste critique introuvable" }, { status: 404 });

    const profil = await prisma.profilRH.findUnique({ where: { id: Number(profilRHId) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    const successeur = await prisma.successeurPotentiel.upsert({
      where: { posteCritiqueId_profilRHId: { posteCritiqueId: Number(id), profilRHId: Number(profilRHId) } },
      create: {
        posteCritiqueId: Number(id),
        profilRHId:      Number(profilRHId),
        readiness:       readiness as NiveauReadiness,
        estTalentCle:    estTalentCle ?? false,
        notes:           notes ?? null,
      },
      update: {
        readiness:    readiness as NiveauReadiness,
        estTalentCle: estTalentCle ?? false,
        notes:        notes ?? null,
        actif:        true,   // ré-ajout → réactive un successeur retiré
      },
      include: {
        profilRH: {
          select: {
            id: true, matricule: true, fonction: true, departement: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        },
      },
    });

    return NextResponse.json({ data: successeur }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/carrieres/plan-succession/[id]/successeurs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/rh/carrieres/plan-succession/[id]/successeurs
 * Retirer un successeur.
 * Body: { profilRHId }
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id }      = await params;
    const { profilRHId } = await req.json();
    if (!profilRHId) return NextResponse.json({ error: "profilRHId requis" }, { status: 400 });

    const existing = await prisma.successeurPotentiel.findUnique({
      where: { posteCritiqueId_profilRHId: { posteCritiqueId: Number(id), profilRHId: Number(profilRHId) } },
    });
    if (!existing) return NextResponse.json({ error: "Successeur introuvable" }, { status: 404 });
    if (!existing.actif) return NextResponse.json({ error: "Successeur déjà retiré" }, { status: 400 });

    // Soft delete (CDC §8) — archivage + traçabilité avant/après.
    await prisma.$transaction([
      prisma.successeurPotentiel.update({
        where: { posteCritiqueId_profilRHId: { posteCritiqueId: Number(id), profilRHId: Number(profilRHId) } },
        data:  { actif: false },
      }),
      prisma.auditLog.create({
        data: {
          userId:   parseInt(session.user.id),
          action:   "ARCHIVER",
          entite:   "SuccesseurPotentiel",
          entiteId: existing.id,
          details:  { avant: JSON.parse(JSON.stringify(existing)), apres: { actif: false } },
        },
      }),
    ]);
    return NextResponse.json({ message: "Successeur retiré" });
  } catch (error) {
    console.error("DELETE /api/admin/rh/carrieres/plan-succession/[id]/successeurs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
