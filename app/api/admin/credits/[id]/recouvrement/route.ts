import { NextResponse } from "next/server";
import { PrioriteNotification, TypeActionRecouvrement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { DELAI_MISE_EN_DEMEURE_DEFAUT, LABEL_TYPE_ACTION, rolesANotifier } from "@/lib/recouvrementCredit";

/**
 * Recouvrement du crédit client classique (CDC digitalisation §5.4) — journal
 * d'actions (appel, visite, mise en demeure, accord d'échéancier, saisie de
 * garantie, note interne) rattaché à un CreditClient. Couvre "Mise en demeure"
 * et "Fiche de visite de recouvrement" (impression via FicheActionRecouvrement.tsx
 * côté client, à partir de l'action créée ici).
 */

export const INCLUDE = {
  effectuePar: { select: { id: true, nom: true, prenom: true } },
};

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/credits/[id]/recouvrement — journal des actions du crédit. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const actions = await prisma.actionRecouvrementCredit.findMany({
      where: { creditId },
      orderBy: { dateAction: "desc" },
      include: INCLUDE,
    });
    return NextResponse.json({ data: actions });
  } catch (error) {
    console.error("GET /admin/credits/[id]/recouvrement:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/credits/[id]/recouvrement
 * Body: { type, notes?, resultat?, delaiRegularisationJours?, lieuVisite?,
 *         personneRencontree?, dateRelance? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = Number(id);
    if (isNaN(creditId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const credit = await prisma.creditClient.findUnique({
      where: { id: creditId },
      select: { id: true, reference: true, soldeRestant: true, client: { select: { nom: true, prenom: true } } },
    });
    if (!credit) return NextResponse.json({ error: "Crédit introuvable" }, { status: 404 });

    const body = await req.json();
    const type = body.type as TypeActionRecouvrement;
    if (!Object.values(TypeActionRecouvrement).includes(type)) {
      return NextResponse.json({ error: "Type d'action invalide" }, { status: 400 });
    }
    if (type === "VISITE_TERRAIN" && !body.lieuVisite) {
      return NextResponse.json({ error: "Le lieu de la visite est obligatoire" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);

    const action = await prisma.$transaction(async (tx) => {
      const a = await tx.actionRecouvrementCredit.create({
        data: {
          creditId,
          type,
          notes: body.notes || null,
          resultat: body.resultat || null,
          delaiRegularisationJours:
            type === "MISE_EN_DEMEURE" ? Number(body.delaiRegularisationJours) || DELAI_MISE_EN_DEMEURE_DEFAUT : null,
          lieuVisite: type === "VISITE_TERRAIN" ? String(body.lieuVisite) : null,
          personneRencontree: body.personneRencontree || null,
          effectueParId: userId,
          dateRelance: body.dateRelance ? new Date(body.dateRelance) : null,
        },
        include: INCLUDE,
      });
      await auditLog(tx, userId, `RECOUV_CREDIT_${type}`, "ActionRecouvrementCredit", a.id, undefined, getRequestMeta(req));

      const { roles, haute } = rolesANotifier(type);
      if (roles.length) {
        const clientNom = `${credit.client.prenom} ${credit.client.nom}`.trim();
        await notifyRoles(tx, roles, {
          titre: `${LABEL_TYPE_ACTION[type]} — crédit ${credit.reference}`,
          message: `${session.user.prenom} ${session.user.nom} a enregistré "${LABEL_TYPE_ACTION[type]}" pour ${clientNom} (solde ${Number(credit.soldeRestant).toLocaleString("fr-FR")} FCFA).`,
          priorite: haute ? PrioriteNotification.HAUTE : PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/admin/credits?detail=${creditId}`,
        });
      }
      return a;
    });
    return NextResponse.json({ data: action }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/credits/[id]/recouvrement:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
