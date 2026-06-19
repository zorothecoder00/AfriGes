import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCommissionMembreSession,
  getRoleMembre,
  ROLES_SUIVI_ACTIONS,
  verifierReunionExploitable,
} from "@/lib/authCommissionRIA";
import { TypeCommissionRIA, PrioriteActionRIA } from "@prisma/client";

// Plans d'action / tâches.
//  - défaut : les tâches dont le membre connecté est responsable
//  - ?scope=commission : toutes les tâches des commissions du membre (suivi)
//  - ?reunionId=N : les tâches issues d'une réunion donnée
export async function GET(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const scope = searchParams.get("scope");
    const reunionId = searchParams.get("reunionId");
    const isAdmin = auth.commission === null;
    const now = new Date();

    // Commissions du membre (vide pour l'admin → pas de filtre commission)
    const memberships = isAdmin
      ? []
      : await prisma.membreCommissionRIA.findMany({
          where: { userId, actif: true },
          select: { typeCommission: true },
        });
    const types = memberships.map((m) => m.typeCommission);

    let where: Record<string, unknown>;
    if (reunionId) {
      where = { reunionId: parseInt(reunionId) };
      if (!isAdmin) where = { ...where, typeCommission: { in: types } };
    } else if (scope === "commission") {
      where = isAdmin ? {} : { typeCommission: { in: types } };
    } else {
      // défaut : mes tâches assignées
      where = { responsableId: userId };
    }
    if (statut) where = { ...where, statut: statut as never };

    const plans = await prisma.planActionCommRIA.findMany({
      where,
      include: {
        resolution: { select: { id: true, numero: true, titre: true } },
        reunion: { select: { id: true, titre: true } },
        responsable: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: [{ dateEcheance: "asc" }],
    });

    const enriched = plans.map((p) => ({
      ...p,
      enRetard:
        !!p.dateEcheance &&
        new Date(p.dateEcheance) < now &&
        !["TERMINE", "REALISE", "ABANDONNE"].includes(p.statut),
    }));

    return NextResponse.json({ plans: enriched });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Création d'une tâche issue d'une réunion (CDC : Président « attribution des tâches » /
// Rapporteur 2 « suivi des actions »). Démarre en NON_DEMARRE.
export async function POST(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    const body = await req.json();
    const { typeCommission, reunionId, resolutionId, titre, description, priorite, responsableId, dateEcheance } = body;

    if (!typeCommission || !titre) {
      return NextResponse.json({ error: "typeCommission et titre requis" }, { status: 400 });
    }

    // auth.commission === null → admin/RESPONSABLE_RIA (supervision, pas de gating)
    if (auth.commission !== null) {
      const role = await getRoleMembre(userId, typeCommission as TypeCommissionRIA);
      if (!role) {
        return NextResponse.json({ error: "Vous n'êtes pas membre actif de cette commission" }, { status: 403 });
      }
      if (!ROLES_SUIVI_ACTIONS.includes(role)) {
        return NextResponse.json({ error: "L'attribution des tâches est réservée au Président et au Rapporteur 2" }, { status: 403 });
      }
      // CDC : une tâche émane d'une réunion → un membre doit la rattacher à une réunion.
      // (Admin/RESPONSABLE_RIA en supervision, auth.commission === null, ne sont pas forcés.)
      if (!reunionId) {
        return NextResponse.json({ error: "Un plan d'action doit être rattaché à une réunion de la commission" }, { status: 400 });
      }
    }

    // Si la tâche est rattachée à une réunion, vérifier la cohérence de la commission
    // et que la réunion est exploitable (EN_COURS / TENUE).
    if (reunionId) {
      const check = await verifierReunionExploitable(Number(reunionId), typeCommission as TypeCommissionRIA);
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
    }

    const plan = await prisma.planActionCommRIA.create({
      data: {
        typeCommission: typeCommission as TypeCommissionRIA,
        reunionId: reunionId ? Number(reunionId) : null,
        resolutionId: resolutionId ? Number(resolutionId) : null,
        titre,
        description: description ?? null,
        priorite: (priorite as PrioriteActionRIA) ?? "MOYENNE",
        statut: "NON_DEMARRE",
        responsableId: responsableId ? Number(responsableId) : null,
        dateEcheance: dateEcheance ? new Date(dateEcheance) : null,
        progression: 0,
      },
      include: {
        responsable: { select: { id: true, nom: true, prenom: true } },
        reunion: { select: { id: true, titre: true } },
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
