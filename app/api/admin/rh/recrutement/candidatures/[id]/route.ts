import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutCandidature } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/recrutement/candidatures/[id]
 * Avancer le statut ou mettre à jour les champs
 * Body workflow: { action: "SHORTLISTER" | "PLANIFIER_ENTRETIEN" | "FAIRE_OFFRE" | "ACCEPTER" | "REJETER" }
 * Body édition:  { noteEntretien?, dateEntretien?, commentaire?, cvUrl?, lettreUrl?, notes? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id }  = await params;
    const body    = await req.json();
    const { action, ...editFields } = body;

    const cand = await prisma.candidature.findUnique({ where: { id: Number(id) } });
    if (!cand) return NextResponse.json({ error: "Candidature introuvable" }, { status: 404 });

    if (action) {
      const TRANSITIONS: Record<string, { from: StatutCandidature[]; to: StatutCandidature }> = {
        SHORTLISTER:        { from: ["RECU"],                         to: "SHORTLISTE" },
        PLANIFIER_ENTRETIEN:{ from: ["RECU","SHORTLISTE"],            to: "ENTRETIEN"  },
        FAIRE_OFFRE:        { from: ["ENTRETIEN","SHORTLISTE"],       to: "OFFRE"      },
        ACCEPTER:           { from: ["OFFRE"],                        to: "ACCEPTE"    },
        REJETER:            { from: ["RECU","SHORTLISTE","ENTRETIEN","OFFRE"], to: "REJETE" },
      };
      const t = TRANSITIONS[action];
      if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
      if (!t.from.includes(cand.statut)) return NextResponse.json({ error: `Impossible depuis ${cand.statut}` }, { status: 422 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = { statut: t.to };
      if (editFields.dateEntretien !== undefined) data.dateEntretien = editFields.dateEntretien ? new Date(editFields.dateEntretien) : null;
      if (editFields.commentaire   !== undefined) data.commentaire   = editFields.commentaire ?? null;

      const updated = await prisma.candidature.update({ where: { id: Number(id) }, data });
      return NextResponse.json({ data: updated });
    }

    // Édition libre
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (editFields.noteEntretien !== undefined) data.noteEntretien = editFields.noteEntretien !== null ? Number(editFields.noteEntretien) : null;
    if (editFields.dateEntretien !== undefined) data.dateEntretien = editFields.dateEntretien ? new Date(editFields.dateEntretien) : null;
    if (editFields.commentaire   !== undefined) data.commentaire   = editFields.commentaire   ?? null;
    if (editFields.cvUrl         !== undefined) data.cvUrl         = editFields.cvUrl         ?? null;
    if (editFields.lettreUrl     !== undefined) data.lettreUrl     = editFields.lettreUrl     ?? null;
    if (editFields.notes         !== undefined) data.notes         = editFields.notes         ?? null;

    const updated = await prisma.candidature.update({ where: { id: Number(id) }, data });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH candidatures/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
