import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { notifyDecisionAvancePret } from "@/lib/notificationsRH";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/paie/prets/[id]
 *   Body: { action: "VALIDER_MANAGER" | "APPROUVER" | "REJETER"
 *                  | "SOLDER" | "EN_DEFAUT" | "REACTIVER", commentaire?,
 *           tauxInteret?, dureesMois? }   // recalcul facultatif à l'approbation
 *         ou { montantRestant } pour réduction du solde (après versement mensualité)
 *
 *   Workflow demande : EN_ATTENTE →(VALIDER_MANAGER)→ VALIDE_MANAGER →(APPROUVER)→ EN_COURS.
 *   APPROUVER décaisse le prêt : c'est là que le taux/échéancier définitifs sont fixés.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { action, montantRestant, commentaire, tauxInteret, dureesMois } = body;

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
    if (action === "REJETER" && commentaire) data.commentaire = commentaire;
    if (action === "APPROUVER") {
      data.approuveParId   = parseInt(session.user.id);
      data.dateApprobation = new Date();
      // Recalcul facultatif du taux/échéancier définitif à l'approbation
      const taux    = tauxInteret !== undefined ? Number(tauxInteret) : Number(pret.tauxInteret);
      const duree   = dureesMois  !== undefined ? Number(dureesMois)  : pret.dureesMois;
      const totalDu = Number(pret.montant) * (1 + taux / 100);
      data.tauxInteret    = taux;
      data.dureesMois     = duree;
      data.montantMensuel = Math.ceil(totalDu / Math.max(1, duree));
      data.montantRestant = totalDu;
    }

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
    console.error("PATCH /api/admin/rh/paie/prets/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
