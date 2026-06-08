import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import {
  StatutCollaborateur,
  TypeContrat,
  NiveauHierarchique,
  SituationMatrimoniale,
  Sexe,
} from "@prisma/client";

/**
 * GET /api/admin/rh/collaborateurs
 * Liste tous les ProfilRH avec informations User + Gestionnaire
 *
 * Query:
 *   search       — nom, prénom, matricule, email
 *   statut       — StatutCollaborateur
 *   departement  — filtre libre
 *   typeContrat  — TypeContrat
 *   page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search      = searchParams.get("search")?.trim() ?? "";
    const statut      = searchParams.get("statut") as StatutCollaborateur | null;
    const departement = searchParams.get("departement")?.trim() ?? "";
    const typeContrat = searchParams.get("typeContrat") as TypeContrat | null;
    const page        = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit       = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip        = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut)      where.statut      = statut;
    if (departement) where.departement = { contains: departement, mode: "insensitive" };
    if (typeContrat) where.typeContrat = typeContrat;
    if (search) {
      where.OR = [
        { matricule: { contains: search, mode: "insensitive" } },
        { fonction:  { contains: search, mode: "insensitive" } },
        { gestionnaire: { member: { nom:    { contains: search, mode: "insensitive" } } } },
        { gestionnaire: { member: { prenom: { contains: search, mode: "insensitive" } } } },
        { gestionnaire: { member: { email:  { contains: search, mode: "insensitive" } } } },
      ];
    }

    const [collaborateurs, total] = await Promise.all([
      prisma.profilRH.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ statut: "asc" }, { createdAt: "desc" }],
        include: {
          gestionnaire: {
            select: {
              id:   true,
              role: true,
              actif: true,
              member: {
                select: {
                  id: true, nom: true, prenom: true,
                  email: true, telephone: true, photo: true,
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
              matricule: true,
              gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
            },
          },
          _count: { select: { documents: true, demandesConge: true, missions: true } },
        },
      }),
      prisma.profilRH.count({ where }),
    ]);

    // Statistiques rapides
    const [totalActifs, totalEnEssai, totalInactifs] = await Promise.all([
      prisma.profilRH.count({ where: { statut: "ACTIF" } }),
      prisma.profilRH.count({ where: { statut: "EN_PERIODE_ESSAI" } }),
      prisma.profilRH.count({ where: { statut: { in: ["DEMISSIONNAIRE", "LICENCIE", "RETRAITE", "INACTIF"] } } }),
    ]);

    return NextResponse.json({
      data: collaborateurs,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: { totalActifs, totalEnEssai, totalInactifs },
    });
  } catch (error) {
    console.error("GET /api/admin/rh/collaborateurs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/collaborateurs
 * Crée un ProfilRH pour un Gestionnaire existant
 *
 * Body: {
 *   gestionnaireId: number   — Gestionnaire.id (obligatoire)
 *   typeContrat?, dateEmbauche?, dateFin?,
 *   fonction?, service?, departement?, niveauHierarchique?,
 *   dateNaissance?, lieuNaissance?, sexe?,
 *   nationalite?, situationMatrimoniale?, nbEnfants?,
 *   telephoneSecondaire?, notes?, managerId?
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { gestionnaireId } = body;

    if (!gestionnaireId) {
      return NextResponse.json({ error: "gestionnaireId est obligatoire" }, { status: 400 });
    }

    // Vérifier que le gestionnaire existe et n'a pas déjà un ProfilRH
    const gestionnaire = await prisma.gestionnaire.findUnique({
      where: { id: Number(gestionnaireId) },
      include: { profilRH: true },
    });
    if (!gestionnaire) {
      return NextResponse.json({ error: "Gestionnaire introuvable" }, { status: 404 });
    }
    if (gestionnaire.profilRH) {
      return NextResponse.json({ error: "Ce gestionnaire a déjà un dossier RH" }, { status: 409 });
    }

    // Générer le matricule automatiquement : MAT-YYYY-XXXX
    const year  = new Date().getFullYear();
    const count = await prisma.profilRH.count();
    const matricule = `MAT-${year}-${String(count + 1).padStart(4, "0")}`;

    const profil = await prisma.profilRH.create({
      data: {
        gestionnaireId:       Number(gestionnaireId),
        matricule,
        typeContrat:          body.typeContrat          as TypeContrat          | undefined,
        dateEmbauche:         body.dateEmbauche         ? new Date(body.dateEmbauche) : undefined,
        dateFin:              body.dateFin              ? new Date(body.dateFin)      : undefined,
        fonction:             body.fonction             ?? undefined,
        service:              body.service              ?? undefined,
        departement:          body.departement          ?? undefined,
        niveauHierarchique:   body.niveauHierarchique   as NiveauHierarchique   | undefined,
        statut:               body.statut               as StatutCollaborateur  ?? "ACTIF",
        dateNaissance:        body.dateNaissance        ? new Date(body.dateNaissance) : undefined,
        lieuNaissance:        body.lieuNaissance        ?? undefined,
        sexe:                 body.sexe                 as Sexe                 | undefined,
        nationalite:          body.nationalite          ?? undefined,
        situationMatrimoniale:body.situationMatrimoniale as SituationMatrimoniale | undefined,
        nbEnfants:            body.nbEnfants            ? Number(body.nbEnfants) : 0,
        telephoneSecondaire:  body.telephoneSecondaire  ?? undefined,
        managerId:            body.managerId            ? Number(body.managerId) : undefined,
        notes:                body.notes                ?? undefined,
      },
      include: {
        gestionnaire: { select: { member: { select: { nom: true, prenom: true, email: true } } } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId:    parseInt(session.user.id),
        action:    "CREATE",
        entite:    "ProfilRH",
        entiteId:  profil.id,
        details:   `Dossier RH créé — matricule ${matricule}`,
      },
    });

    return NextResponse.json({ data: profil }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/collaborateurs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
