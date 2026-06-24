import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCommissionMembreSession, getRoleMembre, isPresident,
  ROLES_REDACTION_CR, peutOutrepasserGating,
} from "@/lib/authCommissionRIA";
import { StatutResolutionRIA } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

// Workflow de vote (CDC) : EN_PREPARATION → SOUMISE → ADOPTEE|REJETEE → EXECUTEE.
type ResolutionAction = "SOUMETTRE" | "ADOPTER" | "REJETER" | "EXECUTER" | "RETOUR_PREPARATION";

const TRANSITIONS: Record<ResolutionAction, StatutResolutionRIA> = {
  SOUMETTRE: "SOUMISE",
  ADOPTER: "ADOPTEE",
  REJETER: "REJETEE",
  EXECUTER: "EXECUTEE",
  RETOUR_PREPARATION: "EN_PREPARATION",
};

const PRECONDITIONS: Record<ResolutionAction, StatutResolutionRIA[]> = {
  SOUMETTRE: ["EN_PREPARATION"],
  ADOPTER: ["SOUMISE"],
  REJETER: ["SOUMISE"],
  EXECUTER: ["ADOPTEE"],
  RETOUR_PREPARATION: ["SOUMISE"],
};

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const userId = parseInt(auth.session.user.id);

    const resolution = await prisma.resolutionCommRIA.findUnique({
      where: { id: parseInt(id) },
      include: {
        reunion: {
          select: {
            id: true, titre: true, dateHeure: true, lieu: true,
            organisateur: { select: { nom: true, prenom: true } },
            presences: {
              select: {
                present: true, procuration: true,
                membre: { select: { role: true, user: { select: { nom: true, prenom: true } } } },
              },
            },
          },
        },
        responsable: { select: { id: true, nom: true, prenom: true } },
        plansAction: {
          include: { responsable: { select: { id: true, nom: true, prenom: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!resolution) return NextResponse.json({ error: "Résolution introuvable" }, { status: 404 });

    const isAdmin = auth.commission === null;
    const monRole = isAdmin ? "ADMIN" : await getRoleMembre(userId, resolution.typeCommission);
    if (!isAdmin && !monRole) {
      return NextResponse.json({ error: "Vous n'êtes pas membre de cette commission" }, { status: 403 });
    }

    return NextResponse.json({ ...resolution, monRole });
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
    const resolutionId = parseInt(id);
    const userId = parseInt(auth.session.user.id);
    const body = await req.json();
    const { action, titre, description, dateEcheance, responsableId } = body as {
      action?: ResolutionAction; titre?: string; description?: string;
      dateEcheance?: string | null; responsableId?: number | null;
    };

    const existante = await prisma.resolutionCommRIA.findUnique({
      where: { id: resolutionId },
      select: { typeCommission: true, statut: true },
    });
    if (!existante) return NextResponse.json({ error: "Résolution introuvable" }, { status: 404 });

    const skip = peutOutrepasserGating(auth.session.user.role) || auth.commission === null;
    const role = skip ? null : await getRoleMembre(userId, existante.typeCommission);
    if (!skip && !role) {
      return NextResponse.json({ error: "Vous n'êtes pas membre de cette commission" }, { status: 403 });
    }

    const data: Record<string, unknown> = {};

    // Édition du contenu : rédacteurs (Président/Rapporteurs), uniquement en préparation
    const edite = titre !== undefined || description !== undefined || dateEcheance !== undefined || responsableId !== undefined;
    if (edite) {
      if (!skip && !(role && ROLES_REDACTION_CR.includes(role))) {
        return NextResponse.json({ error: "Édition réservée au Président et aux Rapporteurs" }, { status: 403 });
      }
      if (existante.statut !== "EN_PREPARATION") {
        return NextResponse.json({ error: "Une résolution n'est modifiable qu'en préparation" }, { status: 409 });
      }
      if (titre !== undefined) data.titre = titre;
      if (description !== undefined) data.description = description;
      if (dateEcheance !== undefined) data.dateEcheance = dateEcheance ? new Date(dateEcheance) : null;
      if (responsableId !== undefined) data.responsableId = responsableId ? Number(responsableId) : null;
    }

    // Workflow de vote : réservé au Président (CDC — validation des résolutions)
    if (action) {
      const allowed = PRECONDITIONS[action];
      if (!allowed) return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
      if (!allowed.includes(existante.statut)) {
        return NextResponse.json({ error: `Action « ${action} » impossible depuis le statut « ${existante.statut} »` }, { status: 409 });
      }
      if (!skip && !(await isPresident(userId, existante.typeCommission))) {
        return NextResponse.json({ error: "Soumission au vote et décision réservées au Président" }, { status: 403 });
      }
      data.statut = TRANSITIONS[action];
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
    }

    const resolution = await prisma.resolutionCommRIA.update({
      where: { id: resolutionId },
      data,
      include: {
        responsable: { select: { id: true, nom: true, prenom: true } },
        plansAction: true,
      },
    });

    return NextResponse.json(resolution);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
