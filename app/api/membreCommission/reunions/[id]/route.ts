import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCommissionMembreSession, getRoleMembre, isPresident,
  ROLES_PREPARATION_REUNION, peutOutrepasserGating,
} from "@/lib/authCommissionRIA";
import { StatutReunionCommissionRIA } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const userId = parseInt(auth.session.user.id);

    const reunion = await prisma.reunionCommissionRIA.findUnique({
      where: { id: parseInt(id) },
      include: {
        organisateur: { select: { id: true, nom: true, prenom: true } },
        presences: {
          include: { membre: { include: { user: { select: { id: true, nom: true, prenom: true } } } } },
        },
        resolutions: {
          include: { responsable: { select: { id: true, nom: true, prenom: true } } },
          orderBy: { numero: "asc" },
        },
        plansAction: {
          include: { responsable: { select: { id: true, nom: true, prenom: true } } },
          orderBy: { createdAt: "asc" },
        },
        compteRenduStr: { include: { validePar: { select: { id: true, nom: true, prenom: true } } } },
      },
    });
    if (!reunion) return NextResponse.json({ error: "Réunion introuvable" }, { status: 404 });

    const isAdmin = auth.commission === null;
    const monRole = isAdmin ? "ADMIN" : await getRoleMembre(userId, reunion.typeCommission);
    if (!isAdmin && !monRole) {
      return NextResponse.json({ error: "Vous n'êtes pas membre de cette commission" }, { status: 403 });
    }

    return NextResponse.json({ ...reunion, monRole });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reunionId = parseInt(id);
    const userId = parseInt(auth.session.user.id);
    const body = await req.json();
    const { titre, dateHeure, lieu, ordreJour, statut, convoquer } = body;

    const existante = await prisma.reunionCommissionRIA.findUnique({
      where: { id: reunionId },
      select: { typeCommission: true, statut: true },
    });
    if (!existante) return NextResponse.json({ error: "Réunion introuvable" }, { status: 404 });

    const skip = peutOutrepasserGating(auth.session.user.role) || auth.commission === null;
    const role = skip ? null : await getRoleMembre(userId, existante.typeCommission);
    if (!skip && !role) {
      return NextResponse.json({ error: "Vous n'êtes pas membre de cette commission" }, { status: 403 });
    }

    const president = skip || (await isPresident(userId, existante.typeCommission));
    const preparateur = skip || (role !== null && ROLES_PREPARATION_REUNION.includes(role));

    // Convocation + changement de statut = pouvoirs du Président (CDC)
    if ((convoquer === true || statut !== undefined) && !president) {
      return NextResponse.json({ error: "Convocation et changement de statut réservés au Président" }, { status: 403 });
    }
    // Édition logistique (titre/date/lieu/ordre du jour) = préparateurs, et seulement en préparation
    const editeLogistique = titre !== undefined || dateHeure !== undefined || lieu !== undefined || ordreJour !== undefined;
    if (editeLogistique) {
      if (!preparateur) {
        return NextResponse.json({ error: "Préparation réservée au Président et au Rapporteur 1" }, { status: 403 });
      }
      if (existante.statut !== "PLANIFIEE") {
        return NextResponse.json({ error: "La réunion ne peut être modifiée qu'au statut Planifiée" }, { status: 409 });
      }
    }

    const reunion = await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {
        ...(titre !== undefined ? { titre } : {}),
        ...(dateHeure !== undefined ? { dateHeure: new Date(dateHeure) } : {}),
        ...(lieu !== undefined ? { lieu } : {}),
        ...(ordreJour !== undefined ? { ordreJour } : {}),
        ...(statut !== undefined ? { statut: statut as StatutReunionCommissionRIA } : {}),
      };
      if (convoquer === true) {
        data.convocationEnvoyee = true;
        data.dateConvocation = new Date();
      }

      const updated = await tx.reunionCommissionRIA.update({
        where: { id: reunionId },
        data,
        include: { organisateur: { select: { id: true, nom: true, prenom: true } } },
      });

      if (convoquer === true) {
        const membres = await tx.membreCommissionRIA.findMany({
          where: { typeCommission: existante.typeCommission, actif: true },
          select: { id: true },
        });
        for (const m of membres) {
          await tx.presenceReunionRIA.upsert({
            where: { reunionId_membreId: { reunionId, membreId: m.id } },
            create: { reunionId, membreId: m.id, present: false },
            update: {},
          });
        }
      }

      return updated;
    });

    return NextResponse.json(reunion);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
