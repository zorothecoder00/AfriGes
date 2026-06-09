import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/paie/prets/[id]
 *   Body: { action: "SOLDER" | "EN_DEFAUT" }
 *         ou { montantRestant } pour réduction du solde (après versement mensualité)
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { action, montantRestant } = body;

    const pret = await prisma.pretEmploye.findUnique({ where: { id: Number(id) } });
    if (!pret) return NextResponse.json({ error: "Prêt introuvable" }, { status: 404 });

    // Réduction du solde restant
    if (montantRestant !== undefined) {
      const updated = await prisma.pretEmploye.update({
        where: { id: Number(id) },
        data: {
          montantRestant: Math.max(0, Number(montantRestant)),
          statut: Number(montantRestant) <= 0 ? "SOLDE" : pret.statut,
        },
      });
      return NextResponse.json({ data: updated });
    }

    if (!action) return NextResponse.json({ error: "action est obligatoire" }, { status: 400 });

    const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
      SOLDER:    { from: ["EN_COURS"],            to: "SOLDE"    },
      EN_DEFAUT: { from: ["EN_COURS"],            to: "EN_DEFAUT"},
      REACTIVER: { from: ["EN_DEFAUT", "SOLDE"],  to: "EN_COURS" },
    };

    const t = TRANSITIONS[action];
    if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    if (!t.from.includes(pret.statut)) {
      return NextResponse.json({ error: `Impossible depuis ${pret.statut}` }, { status: 422 });
    }

    const updated = await prisma.pretEmploye.update({
      where: { id: Number(id) },
      data:  { statut: t.to as never },
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "UPDATE",
        entite:   "PretEmploye",
        entiteId: updated.id,
        details:  { avant: { statut: pret.statut }, apres: { statut: t.to } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/paie/prets/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
