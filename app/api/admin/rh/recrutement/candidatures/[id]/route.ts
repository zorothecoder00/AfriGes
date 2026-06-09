import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutCandidature } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/recrutement/candidatures/[id]
 *
 * Workflow: { action: "PRE_QUALIFIER" | "SHORTLISTER" | "PLANIFIER_ENTRETIEN" | "ENVOYER_TEST"
 *                    | "VALIDER_CANDIDATURE" | "FAIRE_OFFRE" | "DEMARRER_INTEGRATION"
 *                    | "ACCEPTER" | "REJETER" }
 * Édition libre: { noteEntretien?, noteTest?, scoreCandidat?, dateEntretien?, dateTest?,
 *                  commentaire?, cvUrl?, lettreUrl?, notes?, competences?, formation?,
 *                  experienceAnnees?, sourceCandidat? }
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
        PRE_QUALIFIER:          { from: ["RECU"],                                        to: "PRE_QUALIFICATION" },
        SHORTLISTER:            { from: ["RECU", "PRE_QUALIFICATION"],                   to: "SHORTLISTE"        },
        PLANIFIER_ENTRETIEN:    { from: ["RECU","PRE_QUALIFICATION","SHORTLISTE"],        to: "ENTRETIEN"         },
        ENVOYER_TEST:           { from: ["ENTRETIEN","SHORTLISTE"],                      to: "TEST"              },
        VALIDER_CANDIDATURE:    { from: ["TEST","ENTRETIEN"],                            to: "VALIDATION"        },
        FAIRE_OFFRE:            { from: ["VALIDATION","ENTRETIEN","SHORTLISTE"],         to: "OFFRE"             },
        DEMARRER_INTEGRATION:   { from: ["OFFRE"],                                       to: "INTEGRATION"       },
        ACCEPTER:               { from: ["INTEGRATION","OFFRE"],                         to: "ACCEPTE"           },
        REJETER:                { from: ["RECU","PRE_QUALIFICATION","SHORTLISTE",
                                         "ENTRETIEN","TEST","VALIDATION","OFFRE"],       to: "REJETE"            },
      };

      const t = TRANSITIONS[action];
      if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
      if (!t.from.includes(cand.statut)) {
        return NextResponse.json({ error: `Impossible depuis le statut ${cand.statut}` }, { status: 422 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = { statut: t.to };
      if (editFields.dateEntretien !== undefined) data.dateEntretien = editFields.dateEntretien ? new Date(editFields.dateEntretien) : null;
      if (editFields.dateTest      !== undefined) data.dateTest      = editFields.dateTest      ? new Date(editFields.dateTest)      : null;
      if (editFields.commentaire   !== undefined) data.commentaire   = editFields.commentaire   ?? null;

      const updated = await prisma.candidature.update({ where: { id: Number(id) }, data });
      return NextResponse.json({ data: updated });
    }

    // Édition libre
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (editFields.noteEntretien    !== undefined) data.noteEntretien    = editFields.noteEntretien    !== null ? Number(editFields.noteEntretien)    : null;
    if (editFields.noteTest         !== undefined) data.noteTest         = editFields.noteTest         !== null ? Number(editFields.noteTest)         : null;
    if (editFields.scoreCandidat    !== undefined) data.scoreCandidat    = editFields.scoreCandidat    !== null ? Number(editFields.scoreCandidat)    : null;
    if (editFields.dateEntretien    !== undefined) data.dateEntretien    = editFields.dateEntretien    ? new Date(editFields.dateEntretien)    : null;
    if (editFields.dateTest         !== undefined) data.dateTest         = editFields.dateTest         ? new Date(editFields.dateTest)         : null;
    if (editFields.commentaire      !== undefined) data.commentaire      = editFields.commentaire      ?? null;
    if (editFields.cvUrl            !== undefined) data.cvUrl            = editFields.cvUrl            ?? null;
    if (editFields.lettreUrl        !== undefined) data.lettreUrl        = editFields.lettreUrl        ?? null;
    if (editFields.notes            !== undefined) data.notes            = editFields.notes            ?? null;
    if (editFields.competences      !== undefined) data.competences      = editFields.competences      ?? null;
    if (editFields.formation        !== undefined) data.formation        = editFields.formation        ?? null;
    if (editFields.experienceAnnees !== undefined) data.experienceAnnees = editFields.experienceAnnees !== null ? Number(editFields.experienceAnnees) : null;
    if (editFields.sourceCandidat   !== undefined) data.sourceCandidat   = editFields.sourceCandidat   ?? null;

    const updated = await prisma.candidature.update({ where: { id: Number(id) }, data });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH candidatures/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
