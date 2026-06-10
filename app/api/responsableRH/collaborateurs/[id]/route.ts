import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { StatutCollaborateur, TypeContrat, NiveauHierarchique, SituationMatrimoniale, Sexe } from "@prisma/client";

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
            where:  { actif: true },
            select: { pointDeVente: { select: { id: true, nom: true, code: true } } },
            take:   1,
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
  documents: { orderBy: { createdAt: "desc" as const } },
  _count: {
    select: {
      documents: true, demandesConge: true, missions: true,
      evaluations: true, procedures: true, fichesPaie: true,
      participationsFormation: true, pointages: true, avantages: true,
    },
  },
};

/** GET /api/responsableRH/collaborateurs/[id] */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const profil = await prisma.profilRH.findUnique({
      where:   { id: Number(id) },
      include: PROFIL_INCLUDE,
    });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    return NextResponse.json({ data: profil });
  } catch (error) {
    console.error("GET /api/responsableRH/collaborateurs/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** PATCH /api/responsableRH/collaborateurs/[id] */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (body.typeContrat           !== undefined) data.typeContrat           = body.typeContrat           as TypeContrat           || null;
    if (body.dateEmbauche          !== undefined) data.dateEmbauche          = body.dateEmbauche          ? new Date(body.dateEmbauche)    : null;
    if (body.dateFin               !== undefined) data.dateFin               = body.dateFin               ? new Date(body.dateFin)          : null;
    if (body.fonction              !== undefined) data.fonction              = body.fonction              || null;
    if (body.service               !== undefined) data.service               = body.service               || null;
    if (body.departement           !== undefined) data.departement           = body.departement           || null;
    if (body.niveauHierarchique    !== undefined) data.niveauHierarchique    = body.niveauHierarchique    as NiveauHierarchique    || null;
    if (body.statut                !== undefined) data.statut                = body.statut                as StatutCollaborateur;
    if (body.dateNaissance         !== undefined) data.dateNaissance         = body.dateNaissance         ? new Date(body.dateNaissance)   : null;
    if (body.lieuNaissance         !== undefined) data.lieuNaissance         = body.lieuNaissance         || null;
    if (body.sexe                  !== undefined) data.sexe                  = body.sexe                  as Sexe                  || null;
    if (body.nationalite           !== undefined) data.nationalite           = body.nationalite           || null;
    if (body.situationMatrimoniale !== undefined) data.situationMatrimoniale = body.situationMatrimoniale as SituationMatrimoniale || null;
    if (body.nbEnfants             !== undefined) data.nbEnfants             = Number(body.nbEnfants);
    if (body.telephoneSecondaire   !== undefined) data.telephoneSecondaire   = body.telephoneSecondaire   || null;
    if (body.managerId             !== undefined) data.managerId             = body.managerId ? Number(body.managerId) : null;
    if (body.notes                 !== undefined) data.notes                 = body.notes                 || null;

    const profil = await prisma.profilRH.update({
      where:   { id: Number(id) },
      data,
      include: PROFIL_INCLUDE,
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "UPDATE",
        entite:   "ProfilRH",
        entiteId: Number(id),
        details:  `Dossier RH mis à jour par RH`,
      },
    });

    return NextResponse.json({ data: profil });
  } catch (error) {
    console.error("PATCH /api/responsableRH/collaborateurs/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** DELETE /api/responsableRH/collaborateurs/[id] — désactive (INACTIF) plutôt que suppression physique */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const profil = await prisma.profilRH.findUnique({ where: { id: Number(id) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    await prisma.profilRH.update({
      where: { id: Number(id) },
      data:  { statut: "INACTIF" },
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "DESACTIVER",
        entite:   "ProfilRH",
        entiteId: Number(id),
        details:  `Collaborateur désactivé (INACTIF) par RH`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/responsableRH/collaborateurs/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
