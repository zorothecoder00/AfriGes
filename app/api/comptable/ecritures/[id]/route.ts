import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession, getComptablePdvId, ecritureDansPerimetrePdv } from "@/lib/authComptable";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "comptabilite", "LECTURE");
    if (denied) return denied;

    const { id } = await params;
    const pdvId = await getComptablePdvId(session);
    if (pdvId !== null && !(await ecritureDansPerimetrePdv(pdvId, Number(id)))) {
      return NextResponse.json({ error: "Écriture hors de votre périmètre PDV" }, { status: 403 });
    }

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
        controlePar: { select: { id: true, nom: true, prenom: true } },
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
    const pdvId = await getComptablePdvId(session);
    if (pdvId !== null && !(await ecritureDansPerimetrePdv(pdvId, Number(id)))) {
      return NextResponse.json({ error: "Écriture hors de votre périmètre PDV" }, { status: 403 });
    }

    const body = await req.json();
    const { statut, libelle, notes, lignes } = body;

    // CDC §68 — RBAC granulaire : une validation finale exige l'action
    // VALIDATION, toute autre modification (y compris le contrôle intermédiaire)
    // exige MODIFICATION. Complémentaire à la séparation des fonctions
    // ci-dessous (les deux contrôles s'appliquent, ni l'un ni l'autre ne
    // remplace l'autre).
    const denied = await requirePermission(session, "comptabilite", statut === "VALIDE" ? "VALIDATION" : "MODIFICATION");
    if (denied) return denied;

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

    // Séparation des fonctions (CDC §43-44) : Saisie → Contrôle → Validation,
    // par des personnes distinctes (Agent → Comptable → Chef comptable). Le
    // créateur ne peut ni contrôler ni valider sa propre écriture ; si un
    // contrôle intermédiaire a eu lieu (A_CONTROLER), le contrôleur ne peut
    // pas non plus être celui qui valide — 3 acteurs distincts sur ce chemin.
    // La transition directe BROUILLON→VALIDE (2 acteurs) reste autorisée.
    const estControle = statut === "A_CONTROLER";
    const estValidationFinale = statut === "VALIDE";
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const currentUserId = Number(session.user.id);
    if ((estControle || estValidationFinale) && !isAdmin && existing.userId === currentUserId) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas contrôler ou valider une écriture que vous avez vous-même saisie — faites-la traiter par un autre comptable ou un administrateur" },
        { status: 403 },
      );
    }
    if (estValidationFinale && !isAdmin && existing.controleParId && existing.controleParId === currentUserId) {
      return NextResponse.json(
        { error: "Vous avez déjà contrôlé cette écriture — la validation finale doit venir d'un 3e utilisateur (Chef comptable)" },
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
    let lignesAvant: { compteId: number; libelle: string; debit: number; credit: number }[] | null = null;
    const updated = await prisma.$transaction(async (tx) => {
      if (lignes && Array.isArray(lignes)) {
        // CDC §45 — piste d'audit : capture l'état des lignes AVANT suppression,
        // pour que le diff avant/après reste consultable dans AuditLog.details
        // même si les lignes elles-mêmes sont remplacées (une écriture BROUILLON
        // se modifie librement — seule VALIDE/CLOTURE est verrouillée ci-dessus).
        const ancienneLignes = await tx.ligneEcriture.findMany({
          where: { ecritureId: Number(id) },
          select: { compteId: true, libelle: true, debit: true, credit: true },
        });
        lignesAvant = ancienneLignes.map((l) => ({ compteId: l.compteId, libelle: l.libelle, debit: Number(l.debit), credit: Number(l.credit) }));

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
          ...(statut === "A_CONTROLER" && existing.statut !== "A_CONTROLER" && { dateControle: new Date(), controleParId: userId }),
        },
        include: {
          lignes: {
            include: { compte: { select: { id: true, numero: true, libelle: true } } },
          },
        },
      });

      const action = estValidationFinale ? "VALIDATION_ECRITURE" : estControle ? "CONTROLE_ECRITURE" : "MODIFICATION_ECRITURE";
      await auditLog(tx, userId, action, "EcritureComptable", u.id, {
        statutAvant: existing.statut, statutApres: u.statut,
        libelleAvant: existing.libelle, libelleApres: u.libelle,
        ...(lignesAvant && { lignesAvant, lignesApres: u.lignes.map((l) => ({ compteId: l.compte.id, libelle: l.libelle, debit: Number(l.debit), credit: Number(l.credit) })) }),
      }, meta);

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
    const denied = await requirePermission(session, "comptabilite", "SUPPRESSION_LOGIQUE");
    if (denied) return denied;

    const { id } = await params;
    const pdvId = await getComptablePdvId(session);
    if (pdvId !== null && !(await ecritureDansPerimetrePdv(pdvId, Number(id)))) {
      return NextResponse.json({ error: "Écriture hors de votre périmètre PDV" }, { status: 403 });
    }

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
