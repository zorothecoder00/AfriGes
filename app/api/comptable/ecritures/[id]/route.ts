import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

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
            compte: {
              select: {
                id: true, numero: true, libelle: true, type: true, sens: true,
                tiersType: true, tiersNom: true,
                client: { select: { nom: true, prenom: true } },
                fournisseur: { select: { nom: true } },
              },
            },
          },
          orderBy: { id: "asc" },
        },
        user: { select: { id: true, nom: true, prenom: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
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

    // Une écriture validée ou clôturée ne peut plus être modifiée directement
    // (CDC §12/§13) — seule la contrepassation (POST .../contrepasser) permet
    // de la neutraliser, sans jamais l'altérer ni la supprimer.
    if (existing.statut === "VALIDE" || existing.statut === "CLOTURE") {
      return NextResponse.json(
        { error: "Une écriture validée ou clôturée ne peut plus être modifiée — utilisez la contrepassation" },
        { status: 400 },
      );
    }

    // Séparation des tâches (CDC §43-44) : celui qui a saisi une écriture ne peut
    // pas la valider lui-même — un autre comptable, ou l'admin/superadmin (rôle
    // de supervision transverse déjà reconnu ailleurs dans AfriGes, ex. Paie
    // "Validation Direction"), doit le faire.
    const estValidation = statut === "VALIDE" || statut === "A_CONTROLER";
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    if (estValidation && !isAdmin && existing.userId === Number(session.user.id)) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas valider une écriture que vous avez vous-même saisie — faites-la valider par un autre comptable ou un administrateur" },
        { status: 403 },
      );
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
    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
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

      const u = await tx.ecritureComptable.update({
        where: { id: Number(id) },
        data: {
          ...(statut  !== undefined && { statut }),
          ...(libelle !== undefined && { libelle }),
          ...(notes   !== undefined && { notes }),
          // CDC §10 — "Date de validation" : stampée une seule fois, à l'instant
          // précis où l'écriture devient VALIDE (jamais réécrite ensuite, une
          // écriture VALIDE ne se modifiant plus directement — CDC §13).
          ...(statut === "VALIDE" && existing.statut !== "VALIDE" && { dateValidation: new Date(), valideParId: userId }),
        },
        include: {
          lignes: {
            include: { compte: { select: { id: true, numero: true, libelle: true } } },
          },
        },
      });

      const action = estValidation ? "VALIDATION_ECRITURE" : "MODIFICATION_ECRITURE";
      await auditLog(tx, userId, action, "EcritureComptable", u.id, { statutAvant: existing.statut, statutApres: u.statut }, meta);

      return u;
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.ecritureComptable.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Écriture introuvable" }, { status: 404 });

    if (existing.statut !== "BROUILLON") {
      return NextResponse.json({ error: "Seules les écritures en brouillon peuvent être supprimées" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    await prisma.$transaction(async (tx) => {
      await tx.ligneEcriture.deleteMany({ where: { ecritureId: Number(id) } });
      await tx.ecritureComptable.delete({ where: { id: Number(id) } });
      await auditLog(tx, userId, "SUPPRESSION_ECRITURE_BROUILLON", "EcritureComptable", Number(id), { reference: existing.reference, libelle: existing.libelle }, meta);
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
