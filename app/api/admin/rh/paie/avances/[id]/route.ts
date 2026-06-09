import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/paie/avances/[id]
 *   Body: { action: "APPROUVER" | "REJETER" | "REMBOURSER", commentaire? }
 *         ou { montantRestant } pour mise à jour du solde
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { action, commentaire, montantRestant } = body;

    const avance = await prisma.avanceSalaire.findUnique({ where: { id: Number(id) } });
    if (!avance) return NextResponse.json({ error: "Avance introuvable" }, { status: 404 });

    // Mise à jour solde restant
    if (montantRestant !== undefined) {
      const updated = await prisma.avanceSalaire.update({
        where: { id: Number(id) },
        data: {
          montantRestant: Number(montantRestant),
          statut: Number(montantRestant) <= 0 ? "REMBOURSE" : avance.statut,
        },
      });
      return NextResponse.json({ data: updated });
    }

    if (!action) return NextResponse.json({ error: "action est obligatoire" }, { status: 400 });

    const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
      APPROUVER:  { from: ["EN_ATTENTE"], to: "APPROUVE"  },
      REJETER:    { from: ["EN_ATTENTE"], to: "REJETE"    },
      REMBOURSER: { from: ["APPROUVE"],  to: "REMBOURSE" },
    };

    const t = TRANSITIONS[action];
    if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    if (!t.from.includes(avance.statut)) {
      return NextResponse.json({ error: `Impossible depuis ${avance.statut}` }, { status: 422 });
    }

    const updated = await prisma.avanceSalaire.update({
      where: { id: Number(id) },
      data: {
        statut:          t.to as never,
        commentaire:     commentaire ?? null,
        approuveParId:   action === "APPROUVER" ? parseInt(session.user.id) : undefined,
        dateApprobation: action === "APPROUVER" ? new Date() : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "UPDATE",
        entite:   "AvanceSalaire",
        entiteId: updated.id,
        details:  { avant: { statut: avance.statut }, apres: { statut: t.to } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/paie/avances/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
