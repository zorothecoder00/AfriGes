import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import {
  StatutCollaborateur, TypeContrat, NiveauHierarchique,
  SituationMatrimoniale, Sexe,
} from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

const PROFIL_INCLUDE = {
  gestionnaire: {
    select: {
      id: true, role: true, actif: true,
      member: {
        select: {
          id: true, nom: true, prenom: true, email: true,
          telephone: true, photo: true, adresse: true,
          affectationsPDV: {
            where: { actif: true },
            select: { pointDeVente: { select: { id: true, nom: true, code: true } } },
            take: 1,
          },
        },
      },
    },
  },
  manager: {
    select: {
      id: true, matricule: true,
      gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
    },
  },
  subordonnes: {
    select: {
      id: true, matricule: true, fonction: true,
      gestionnaire: { select: { member: { select: { nom: true, prenom: true, photo: true } } } },
    },
  },
  documents: {
    orderBy: { createdAt: "desc" as const },
  },
  _count: {
    select: {
      documents: true,
      demandesConge: true,
      missions: true,
      evaluations: true,
      procedures: true,
      fichesPaie: true,
      participationsFormation: true,
      pointages: true,
      avantages: true,
    },
  },
};

/**
 * GET /api/admin/rh/collaborateurs/[id]
 * Retourne le dossier complet d'un collaborateur
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;

    const profil = await prisma.profilRH.findUnique({
      where: { id: Number(id) },
      include: PROFIL_INCLUDE,
    });

    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    return NextResponse.json({ data: profil });
  } catch (error) {
    console.error("GET /api/admin/rh/collaborateurs/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/rh/collaborateurs/[id]
 * Met à jour le ProfilRH (tous les champs sont optionnels)
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.profilRH.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};

    if (body.typeContrat          !== undefined) data.typeContrat          = body.typeContrat          as TypeContrat;
    if (body.dateEmbauche         !== undefined) data.dateEmbauche         = body.dateEmbauche ? new Date(body.dateEmbauche) : null;
    if (body.dateFin              !== undefined) data.dateFin              = body.dateFin      ? new Date(body.dateFin)      : null;
    if (body.fonction             !== undefined) data.fonction             = body.fonction;
    if (body.service              !== undefined) data.service              = body.service;
    if (body.departement          !== undefined) data.departement          = body.departement;
    if (body.niveauHierarchique   !== undefined) data.niveauHierarchique   = body.niveauHierarchique as NiveauHierarchique;
    if (body.statut               !== undefined) data.statut               = body.statut               as StatutCollaborateur;
    if (body.dateNaissance        !== undefined) data.dateNaissance        = body.dateNaissance ? new Date(body.dateNaissance) : null;
    if (body.lieuNaissance        !== undefined) data.lieuNaissance        = body.lieuNaissance;
    if (body.sexe                 !== undefined) data.sexe                 = body.sexe                 as Sexe;
    if (body.nationalite          !== undefined) data.nationalite          = body.nationalite;
    if (body.situationMatrimoniale!== undefined) data.situationMatrimoniale= body.situationMatrimoniale as SituationMatrimoniale;
    if (body.nbEnfants            !== undefined) data.nbEnfants            = Number(body.nbEnfants);
    if (body.telephoneSecondaire  !== undefined) data.telephoneSecondaire  = body.telephoneSecondaire;
    if (body.managerId            !== undefined) data.managerId            = body.managerId ? Number(body.managerId) : null;
    if (body.notes                !== undefined) data.notes                = body.notes;

    // Snapshot avant modification (uniquement les champs modifiés)
    const avant: Record<string, unknown> = {};
    for (const key of Object.keys(data)) {
      avant[key] = (existing as Record<string, unknown>)[key] ?? null;
    }

    const updated = await prisma.profilRH.update({
      where: { id: Number(id) },
      data,
      include: PROFIL_INCLUDE,
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "UPDATE",
        entite:   "ProfilRH",
        entiteId: updated.id,
        details:  JSON.parse(JSON.stringify({ avant, apres: data })),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/collaborateurs/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
