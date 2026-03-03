import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const ecriture = await prisma.ecritureComptable.findUnique({
      where: { id: Number(id) },
      include: {
        lignes: {
          include: {
            compte: { select: { id: true, numero: true, libelle: true, type: true, sens: true } },
          },
          orderBy: { id: "asc" },
        },
        user: { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (!ecriture) return NextResponse.json({ error: "Écriture introuvable" }, { status: 404 });
    return NextResponse.json({ data: ecriture });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { statut, libelle, notes, lignes } = body;

    const existing = await prisma.ecritureComptable.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Écriture introuvable" }, { status: 404 });

    // Seules les écritures BROUILLON peuvent être modifiées (sauf pour la validation)
    if (existing.statut === "VALIDE" && statut !== "ANNULE") {
      return NextResponse.json({ error: "Une écriture validée ne peut qu'être annulée" }, { status: 400 });
    }

    // Si on fournit des lignes, valider l'équilibre
    if (lignes && Array.isArray(lignes)) {
      let totalDebit  = 0;
      let totalCredit = 0;
      for (const l of lignes) {
        totalDebit  += Number(l.debit  || 0);
        totalCredit += Number(l.credit || 0);
      }
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return NextResponse.json({
          error: `Écriture non équilibrée : débit ${totalDebit.toFixed(2)} ≠ crédit ${totalCredit.toFixed(2)}`,
        }, { status: 400 });
      }
    }

    // Mise à jour dans une transaction si les lignes sont modifiées
    const updated = await prisma.$transaction(async (tx) => {
      if (lignes && Array.isArray(lignes)) {
        // Supprimer les anciennes lignes et recréer
        await tx.ligneEcriture.deleteMany({ where: { ecritureId: Number(id) } });
        await tx.ligneEcriture.createMany({
          data: lignes.map((l: {
            compteId: number;
            libelle?: string;
            debit?: number;
            credit?: number;
            isTva?: boolean;
            tauxTva?: number;
            montantTva?: number;
          }) => ({
            ecritureId: Number(id),
            compteId:   Number(l.compteId),
            libelle:    l.libelle || existing.libelle,
            debit:      Number(l.debit  || 0),
            credit:     Number(l.credit || 0),
            isTva:      Boolean(l.isTva),
            tauxTva:    l.tauxTva    != null ? Number(l.tauxTva)    : null,
            montantTva: l.montantTva != null ? Number(l.montantTva) : null,
          })),
        });
      }

      return tx.ecritureComptable.update({
        where: { id: Number(id) },
        data: {
          ...(statut  !== undefined && { statut }),
          ...(libelle !== undefined && { libelle }),
          ...(notes   !== undefined && { notes }),
        },
        include: {
          lignes: {
            include: { compte: { select: { id: true, numero: true, libelle: true } } },
          },
        },
      });
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.ecritureComptable.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Écriture introuvable" }, { status: 404 });

    if (existing.statut !== "BROUILLON") {
      return NextResponse.json({ error: "Seules les écritures en brouillon peuvent être supprimées" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.ligneEcriture.deleteMany({ where: { ecritureId: Number(id) } });
      await tx.ecritureComptable.delete({ where: { id: Number(id) } });
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
