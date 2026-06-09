import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutFichePaie } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/rh/paie/[id]
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const fiche = await prisma.fichePaie.findUnique({
      where: { id: Number(id) },
      include: {
        composants: true,
        profilRH: {
          select: {
            id: true, matricule: true, fonction: true, departement: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true, photo: true } } } },
          },
        },
      },
    });
    if (!fiche) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
    return NextResponse.json({ data: fiche });
  } catch (error) {
    console.error("GET /api/admin/rh/paie/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/rh/paie/[id]
 *
 * Workflow:
 *   action: "SOUMETTRE_CONTROLE" | "VALIDER" | "REFUSER_CONTROLE"
 *         | "METTRE_EN_PAIEMENT" | "MARQUER_PAYE" | "REPASSER_BROUILLON"
 *   + modePaiement? (pour METTRE_EN_PAIEMENT)
 *
 * Édition (BROUILLON seulement):
 *   { salaireBase?, composants?, notes?, fichierUrl? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { action, composants, salaireBase, notes, fichierUrl, modePaiement } = body;

    const fiche = await prisma.fichePaie.findUnique({ where: { id: Number(id) } });
    if (!fiche) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });

    // ── Workflow statut ────────────────────────────────────────────────────────
    if (action) {
      const userId = parseInt(session.user.id);

      type Transition = {
        from: StatutFichePaie[];
        to: StatutFichePaie;
        extra?: (now: Date) => Record<string, unknown>;
      };

      const TRANSITIONS: Record<string, Transition> = {
        SOUMETTRE_CONTROLE: {
          from: ["BROUILLON"],
          to:   "CONTROLE",
        },
        VALIDER: {
          from: ["CONTROLE", "BROUILLON"],
          to:   "VALIDE",
          extra: (now) => ({ valideParId: userId, dateValidation: now }),
        },
        REFUSER_CONTROLE: {
          from: ["CONTROLE"],
          to:   "BROUILLON",
        },
        METTRE_EN_PAIEMENT: {
          from: ["VALIDE"],
          to:   "EN_PAIEMENT",
          extra: (now) => ({
            misEnPaiementParId: userId,
            dateMiseEnPaiement: now,
            modePaiement: modePaiement ?? null,
          }),
        },
        MARQUER_PAYE: {
          from: ["EN_PAIEMENT"],
          to:   "PAYE",
        },
        REPASSER_BROUILLON: {
          from: ["VALIDE", "CONTROLE"],
          to:   "BROUILLON",
        },
      };

      const transition = TRANSITIONS[action];
      if (!transition) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
      if (!transition.from.includes(fiche.statut)) {
        return NextResponse.json({ error: `Impossible depuis ${fiche.statut}` }, { status: 422 });
      }

      const now   = new Date();
      const extra = transition.extra ? transition.extra(now) : {};

      const updated = await prisma.fichePaie.update({
        where: { id: Number(id) },
        data:  { statut: transition.to, ...extra } as never,
        include: { composants: true },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action:   "UPDATE",
          entite:   "FichePaie",
          entiteId: updated.id,
          details:  { avant: { statut: fiche.statut }, apres: { statut: transition.to } },
        },
      });

      return NextResponse.json({ data: updated });
    }

    // ── Mise à jour complète (brouillon seulement) ─────────────────────────────
    if (fiche.statut !== "BROUILLON") {
      return NextResponse.json({ error: "Seules les fiches BROUILLON sont modifiables" }, { status: 422 });
    }

    const base = Number(salaireBase ?? fiche.salaireBase);

    let updated;
    if (composants) {
      const totalBrut     = composants.filter((c: { isRetenue: boolean }) => !c.isRetenue).reduce((s: number, c: { montant: number }) => s + Number(c.montant), base);
      const totalRetenues = composants.filter((c: { isRetenue: boolean }) =>  c.isRetenue).reduce((s: number, c: { montant: number }) => s + Number(c.montant), 0);
      const netAPayer     = totalBrut - totalRetenues;

      updated = await prisma.$transaction(async (tx) => {
        await tx.composantSalaire.deleteMany({ where: { fichePaieId: Number(id) } });
        return tx.fichePaie.update({
          where: { id: Number(id) },
          data: {
            salaireBase: base,
            totalBrut,
            totalRetenues,
            netAPayer,
            notes:      notes      !== undefined ? (notes ?? null)      : undefined,
            fichierUrl: fichierUrl !== undefined ? (fichierUrl ?? null)  : undefined,
            composants: {
              create: composants.map((c: { type: string; libelle: string; montant: number; isRetenue: boolean }) => ({
                type: c.type, libelle: c.libelle, montant: Number(c.montant), isRetenue: c.isRetenue ?? false,
              })),
            },
          },
          include: { composants: true },
        });
      });
    } else {
      updated = await prisma.fichePaie.update({
        where: { id: Number(id) },
        data: {
          salaireBase: base,
          notes:      notes      !== undefined ? (notes ?? null)     : undefined,
          fichierUrl: fichierUrl !== undefined ? (fichierUrl ?? null) : undefined,
        },
        include: { composants: true },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "UPDATE",
        entite:   "FichePaie",
        entiteId: Number(id),
        details:  { avant: { statut: fiche.statut }, apres: { edited: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/paie/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
