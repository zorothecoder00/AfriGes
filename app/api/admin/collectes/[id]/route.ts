import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/collectes/[id]
 * Détail d'une collecte avec toutes ses lignes
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;

    const collecte = await prisma.collecteJournaliere.findUnique({
      where: { id: Number(id) },
      include: {
        agent:        { select: { id: true, nom: true, prenom: true } },
        validePar:    { select: { id: true, nom: true, prenom: true } },
        pointDeVente: { select: { id: true, nom: true, code: true } },
        lignes: {
          include: {
            client: {
              select: {
                id: true, nom: true, prenom: true, telephone: true, codeClient: true,
                adresse: true, quartier: true, ville: true,
                segment: true,
                tags: { select: { tag: { select: { id: true, nom: true, couleur: true } } } },
              },
            },
            souscription: {
              select: {
                id: true, montantTotal: true, montantVerse: true, montantRestant: true,
                statut: true,
                pack: { select: { id: true, nom: true, type: true } },
              },
            },
            versementPack: {
              select: { id: true, montant: true, datePaiement: true, reference: true },
            },
          },
        },
      },
    });

    if (!collecte) {
      return NextResponse.json({ message: "Collecte introuvable" }, { status: 404 });
    }

    return NextResponse.json({ data: collecte });
  } catch (error) {
    console.error("GET /api/admin/collectes/[id]", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/collectes/[id]
 * Mettre à jour les montants collectés sur les lignes (avant validation)
 * Body: { lignes: [{ ligneId, montantCollecte, statut, notes }], notes? }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { lignes, notes } = body;

    const collecte = await prisma.collecteJournaliere.findUnique({
      where: { id: Number(id) },
    });

    if (!collecte) {
      return NextResponse.json({ message: "Collecte introuvable" }, { status: 404 });
    }
    if (collecte.statut !== "EN_COURS") {
      return NextResponse.json(
        { message: "Seule une collecte EN_COURS peut être modifiée" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Mettre à jour chaque ligne
      if (Array.isArray(lignes)) {
        for (const ligne of lignes) {
          await tx.ligneCollecte.update({
            where: { id: Number(ligne.ligneId) },
            data: {
              montantCollecte: Number(ligne.montantCollecte ?? 0),
              statut:          ligne.statut ?? undefined,
              notes:           ligne.notes  ?? undefined,
            },
          });
        }
      }

      // Recalculer montantCollecte total
      const allLignes = await tx.ligneCollecte.findMany({
        where: { collecteId: Number(id) },
        select: { montantCollecte: true },
      });
      const totalCollecte = allLignes.reduce(
        (sum, l) => sum + Number(l.montantCollecte),
        0
      );

      await tx.collecteJournaliere.update({
        where: { id: Number(id) },
        data: {
          montantCollecte: totalCollecte,
          ...(notes !== undefined && { notes }),
        },
      });
    });

    const updated = await prisma.collecteJournaliere.findUnique({
      where: { id: Number(id) },
      include: {
        lignes: {
          include: {
            client:      { select: { id: true, nom: true, prenom: true, telephone: true } },
            souscription:{ select: { id: true, montantTotal: true, montantRestant: true, statut: true, pack: { select: { nom: true } } } },
          },
        },
        agent: { select: { id: true, nom: true, prenom: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/collectes/[id]", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
