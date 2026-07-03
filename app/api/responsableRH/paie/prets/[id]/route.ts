import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { getRHScope, profilDansPerimetre } from "@/lib/scopeRH";
import { notifyDecisionAvancePret } from "@/lib/notificationsRH";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/responsableRH/paie/prets/[id]
 *   Body: { action: "VALIDER_MANAGER" | "APPROUVER" | "REJETER"
 *                  | "SOLDER" | "EN_DEFAUT" | "REACTIVER", commentaire? }
 *         ou { montantRestant } pour réduction du solde (après versement mensualité)
 *   Réservé aux prêts des collaborateurs du PDV du RESPONSABLE_RH.
 *   VALIDER_MANAGER = validation niveau 1 ; APPROUVER décaisse (→ EN_COURS).
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const scope = await getRHScope(session);
    const { id } = await params;
    const body   = await req.json();
    const { action, montantRestant, commentaire } = body;

    const pret = await prisma.pretEmploye.findUnique({ where: { id: Number(id) } });
    if (!pret) return NextResponse.json({ error: "Prêt introuvable" }, { status: 404 });

    if (!profilDansPerimetre(scope, pret.profilRHId)) {
      return NextResponse.json({ error: "Prêt hors de votre périmètre" }, { status: 403 });
    }

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
      VALIDER_MANAGER: { from: ["EN_ATTENTE"],                  to: "VALIDE_MANAGER" },
      APPROUVER:       { from: ["EN_ATTENTE", "VALIDE_MANAGER"], to: "EN_COURS"       },
      REJETER:         { from: ["EN_ATTENTE", "VALIDE_MANAGER"], to: "REJETE"         },
      SOLDER:          { from: ["EN_COURS"],                     to: "SOLDE"          },
      EN_DEFAUT:       { from: ["EN_COURS"],                     to: "EN_DEFAUT"      },
      REACTIVER:       { from: ["EN_DEFAUT", "SOLDE"],           to: "EN_COURS"       },
    };

    const t = TRANSITIONS[action];
    if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    if (!t.from.includes(pret.statut)) {
      return NextResponse.json({ error: `Impossible depuis ${pret.statut}` }, { status: 422 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { statut: t.to };
    if (action === "VALIDER_MANAGER") {
      data.valideManagerParId    = parseInt(session.user.id);
      data.dateValidationManager = new Date();
    }
    if (action === "APPROUVER") {
      data.approuveParId   = parseInt(session.user.id);
      data.dateApprobation = new Date();
    }
    if (action === "REJETER" && commentaire) data.commentaire = commentaire;

    const updated = await prisma.pretEmploye.update({
      where: { id: Number(id) },
      data,
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

    if (["VALIDER_MANAGER", "APPROUVER", "REJETER"].includes(action)) {
      notifyDecisionAvancePret({
        kind:       "PRET",
        profilRHId: pret.profilRHId,
        montant:    Number(pret.montant),
        decision:   (t.to === "EN_COURS" ? "APPROUVE" : t.to) as "VALIDE_MANAGER" | "APPROUVE" | "REJETE",
        motif:      commentaire ?? undefined,
      }).catch(() => {});
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/responsableRH/paie/prets/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
