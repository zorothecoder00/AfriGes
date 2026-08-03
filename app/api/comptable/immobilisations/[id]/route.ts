import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const immo = await prisma.immobilisation.findUnique({
      where: { id: Number(id) },
      include: {
        compte: { select: { numero: true, libelle: true } },
        compteAmortissement: { select: { numero: true, libelle: true } },
        fournisseur: { select: { nom: true } },
        responsable: { select: { nom: true, prenom: true } },
        createur: { select: { nom: true, prenom: true } },
        lignesAmortissement: { orderBy: { periode: "asc" } },
      },
    });
    if (!immo) return NextResponse.json({ error: "Immobilisation introuvable" }, { status: 404 });
    return NextResponse.json({ data: immo });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH — champs non financiers uniquement (localisation, responsable, notes,
 * statut HORS_SERVICE). Les montants ne se modifient jamais directement : ils
 * découlent de l'acquisition et des dotations calculées.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.immobilisation.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Immobilisation introuvable" }, { status: 404 });

    const body = await req.json();
    const { localisation, responsableId, notes, numeroSerie, statut } = body;

    if (statut && !["EN_SERVICE", "HORS_SERVICE"].includes(statut)) {
      return NextResponse.json({ error: "Statut non modifiable directement ici (utilisez /ceder pour une sortie)" }, { status: 400 });
    }

    const updated = await prisma.immobilisation.update({
      where: { id: Number(id) },
      data: {
        ...(localisation !== undefined && { localisation: localisation || null }),
        ...(responsableId !== undefined && { responsableId: responsableId ? Number(responsableId) : null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(numeroSerie !== undefined && { numeroSerie: numeroSerie || null }),
        ...(statut !== undefined && { statut }),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
