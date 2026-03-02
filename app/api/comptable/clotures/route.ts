// app/api/comptable/clotures/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

/**
 * GET  /api/comptable/clotures?annee=2025
 *   → Liste des mois clôturés pour une année
 *
 * POST /api/comptable/clotures
 *   body: { annee: number, mois: number, notes?: string }
 *   → Clôture un mois (verrouillage)
 *
 * DELETE /api/comptable/clotures
 *   body: { annee: number, mois: number }
 *   → Déverrouille un mois (à utiliser avec précaution)
 */

export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const annee = Number(searchParams.get("annee") ?? new Date().getFullYear());

    const clotures = await prisma.clotureComptable.findMany({
      where: { annee },
      include: { clotureUser: { select: { nom: true, prenom: true } } },
      orderBy: { mois: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: clotures.map((c) => ({
        id:        c.id,
        annee:     c.annee,
        mois:      c.mois,
        notes:     c.notes,
        cloturePar: `${c.clotureUser.prenom} ${c.clotureUser.nom}`,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("CLOTURE GET ERROR:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const annee = Number(body.annee);
    const mois  = Number(body.mois);
    const notes = typeof body.notes === "string" ? body.notes.trim() : null;

    if (!annee || mois < 1 || mois > 12) {
      return NextResponse.json({ success: false, message: "Année ou mois invalide" }, { status: 400 });
    }

    // Vérifier que ce mois n'est pas déjà clôturé
    const existing = await prisma.clotureComptable.findUnique({ where: { annee_mois: { annee, mois } } });
    if (existing) {
      return NextResponse.json({ success: false, message: "Ce mois est déjà clôturé" }, { status: 409 });
    }

    const cloture = await prisma.clotureComptable.create({
      data: {
        annee,
        mois,
        notes: notes || null,
        cloturePar: parseInt(session.user.id),
      },
      include: { clotureUser: { select: { nom: true, prenom: true } } },
    });

    return NextResponse.json({
      success: true,
      data: {
        id:         cloture.id,
        annee:      cloture.annee,
        mois:       cloture.mois,
        notes:      cloture.notes,
        cloturePar: `${cloture.clotureUser.prenom} ${cloture.clotureUser.nom}`,
        createdAt:  cloture.createdAt.toISOString(),
      },
      message: `Période ${mois}/${annee} clôturée avec succès`,
    });
  } catch (error) {
    console.error("CLOTURE POST ERROR:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const body  = await req.json();
    const annee = Number(body.annee);
    const mois  = Number(body.mois);

    if (!annee || mois < 1 || mois > 12) {
      return NextResponse.json({ success: false, message: "Année ou mois invalide" }, { status: 400 });
    }

    await prisma.clotureComptable.delete({ where: { annee_mois: { annee, mois } } });

    return NextResponse.json({ success: true, message: `Période ${mois}/${annee} déverrouillée` });
  } catch (error) {
    console.error("CLOTURE DELETE ERROR:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
