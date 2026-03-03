import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

/**
 * POST /api/comptable/journal/valider
 * Body: { entryId: string, notes?: string }
 * Valide une entrée du journal de flux.
 *
 * DELETE /api/comptable/journal/valider
 * Body: { entryId: string }
 * Annule la validation d'une entrée.
 */

export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { entryId, notes } = await req.json();
    if (!entryId || typeof entryId !== "string") {
      return NextResponse.json({ error: "entryId est obligatoire" }, { status: 400 });
    }

    const validation = await prisma.journalValidation.upsert({
      where: { entryId },
      update: {
        notes: notes ?? null,
        valideParId: Number(session.user.id),
        createdAt: new Date(),
      },
      create: {
        entryId,
        notes: notes ?? null,
        valideParId: Number(session.user.id),
      },
      include: {
        validePar: { select: { id: true, nom: true, prenom: true } },
      },
    });

    return NextResponse.json({ data: validation });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { entryId } = await req.json();
    if (!entryId || typeof entryId !== "string") {
      return NextResponse.json({ error: "entryId est obligatoire" }, { status: 400 });
    }

    await prisma.journalValidation.delete({ where: { entryId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
