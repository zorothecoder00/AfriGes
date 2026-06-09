import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutOnboarding } from "@prisma/client";

/**
 * GET /api/admin/rh/onboarding
 * Liste des onboardings avec progression
 * Query: statut, search, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut  = searchParams.get("statut") as StatutOnboarding | null;
    const search  = searchParams.get("search")?.trim() ?? "";
    const page    = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit   = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip    = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (search) {
      where.profilRH = {
        gestionnaire: {
          member: {
            OR: [
              { nom:    { contains: search, mode: "insensitive" } },
              { prenom: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      };
    }

    const [onboardings, total] = await Promise.all([
      prisma.onboardingEmploye.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          profilRH: {
            select: {
              id: true,
              matricule: true,
              emailProfessionnel: true,
              fonction: true,
              departement: true,
              gestionnaire: {
                select: {
                  member: { select: { nom: true, prenom: true, telephone: true } },
                },
              },
            },
          },
          candidature: {
            select: {
              id: true,
              nomCandidat: true,
              prenomCandidat: true,
              poste: { select: { id: true, reference: true, titre: true } },
            },
          },
          template: { select: { id: true, nom: true } },
          _count:   { select: { etapes: true } },
        },
      }),
      prisma.onboardingEmploye.count({ where }),
    ]);

    // Stats résumé
    const stats = await prisma.onboardingEmploye.groupBy({
      by: ["statut"],
      _count: { id: true },
    });
    const statsMap = Object.fromEntries(stats.map((s) => [s.statut, s._count.id]));

    return NextResponse.json({
      data: onboardings,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: statsMap,
    });
  } catch (error) {
    console.error("GET /api/admin/rh/onboarding", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/onboarding
 * Déclenche l'onboarding d'une candidature acceptée.
 * Crée en une transaction : ProfilRH + matricule + emailProfessionnel + OnboardingEmploye + EtapeOnboarding[]
 *
 * Body: {
 *   candidatureId: number
 *   templateId?:   number   — si absent, checklist vide (étapes par défaut)
 *   gestionnaireId: number  — Gestionnaire existant à lier au ProfilRH
 *   fonction?:     string
 *   service?:      string
 *   departement?:  string
 *   typeContrat?:  string
 *   dateEmbauche?: string
 *   managerId?:    number   — ProfilRH.id du manager direct
 *   notes?:        string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const {
      candidatureId, templateId, gestionnaireId,
      fonction, service, departement, typeContrat,
      dateEmbauche, managerId, notes,
    } = body;

    if (!candidatureId) return NextResponse.json({ error: "candidatureId requis" }, { status: 400 });
    if (!gestionnaireId) return NextResponse.json({ error: "gestionnaireId requis" }, { status: 400 });

    // Vérifications préalables
    const candidature = await prisma.candidature.findUnique({
      where: { id: Number(candidatureId) },
      include: { onboarding: true, poste: true },
    });
    if (!candidature) return NextResponse.json({ error: "Candidature introuvable" }, { status: 404 });
    if (!["ACCEPTE", "INTEGRATION"].includes(candidature.statut)) {
      return NextResponse.json({ error: "La candidature doit être ACCEPTE ou INTEGRATION" }, { status: 422 });
    }
    if (candidature.onboarding) {
      return NextResponse.json({ error: "Un onboarding existe déjà pour cette candidature" }, { status: 409 });
    }

    const gestionnaire = await prisma.gestionnaire.findUnique({ where: { id: Number(gestionnaireId) } });
    if (!gestionnaire) return NextResponse.json({ error: "Gestionnaire introuvable" }, { status: 404 });

    // Générer matricule unique : MAT-YYYY-XXXX
    const year = new Date().getFullYear();
    const lastProfil = await prisma.profilRH.findFirst({
      where:   { matricule: { startsWith: `MAT-${year}-` } },
      orderBy: { matricule: "desc" },
    });
    const seq = lastProfil
      ? String(Number(lastProfil.matricule.split("-")[2]) + 1).padStart(4, "0")
      : "0001";
    const matricule = `MAT-${year}-${seq}`;

    // Générer email professionnel : prenom.nom@afriges.com (normalisé)
    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ".");
    const membre = await prisma.user.findUnique({ where: { id: gestionnaire.memberId } });
    const prenom = normalize(membre?.prenom ?? candidature.prenomCandidat);
    const nom    = normalize(membre?.nom    ?? candidature.nomCandidat);
    let emailProfessionnel = `${prenom}.${nom}@afriges.com`;
    // Éviter les doublons
    const emailExists = await prisma.profilRH.findUnique({ where: { emailProfessionnel } });
    if (emailExists) emailProfessionnel = `${prenom}.${nom}.${seq}@afriges.com`;

    // Récupérer les étapes du template si fourni
    const etapesTemplate = templateId
      ? await prisma.etapeTemplate.findMany({
          where:   { templateId: Number(templateId) },
          orderBy: { ordre: "asc" },
        })
      : [];

    // Étapes par défaut si pas de template
    const etapesDefaut = [
      { ordre: 1, titre: "Signature du contrat",     type: "SIGNATURE_CONTRAT" as const, delaiJours: 1,  obligatoire: true,  description: null },
      { ordre: 2, titre: "Remise du matériel",       type: "REMISE_MATERIEL"   as const, delaiJours: 3,  obligatoire: true,  description: null },
      { ordre: 3, titre: "Création des accès",       type: "ACCES_SYSTEME"     as const, delaiJours: 3,  obligatoire: true,  description: null },
      { ordre: 4, titre: "Présentation à l'équipe",  type: "PRESENTATION"      as const, delaiJours: 5,  obligatoire: false, description: null },
      { ordre: 5, titre: "Formation d'intégration",  type: "FORMATION"         as const, delaiJours: 15, obligatoire: true,  description: null },
      { ordre: 6, titre: "Affectation au PDV/poste", type: "AFFECTATION"       as const, delaiJours: 7,  obligatoire: true,  description: null },
    ];

    const etapesSource = etapesTemplate.length > 0 ? etapesTemplate : etapesDefaut;

    // Calculer dateFinPrevue = dateDebut + max(delaiJours)
    const maxDelai = Math.max(...etapesSource.map((e) => e.delaiJours));
    const dateDebut = new Date();
    const dateFinPrevue = new Date(dateDebut);
    dateFinPrevue.setDate(dateFinPrevue.getDate() + maxDelai);

    // Transaction unique
    const result = await prisma.$transaction(async (tx) => {
      // 1. Créer ProfilRH
      const profilRH = await tx.profilRH.create({
        data: {
          gestionnaireId:    Number(gestionnaireId),
          matricule,
          emailProfessionnel,
          fonction:          fonction          ?? null,
          service:           service           ?? null,
          departement:       departement       ?? null,
          typeContrat:       typeContrat       ?? null,
          dateEmbauche:      dateEmbauche      ? new Date(dateEmbauche) : null,
          managerId:         managerId         ? Number(managerId)      : null,
          notes:             notes             ?? null,
        },
      });

      // 2. Créer OnboardingEmploye
      const onboarding = await tx.onboardingEmploye.create({
        data: {
          candidatureId: Number(candidatureId),
          profilRHId:    profilRH.id,
          templateId:    templateId ? Number(templateId) : null,
          dateDebut,
          dateFinPrevue,
          createdById:   Number(session.user.id),
          etapes: {
            create: etapesSource.map((e) => ({
              ordre:       e.ordre,
              titre:       e.titre,
              description: e.description ?? null,
              type:        e.type,
              obligatoire: e.obligatoire,
              dateLimite:  (() => {
                const d = new Date(dateDebut);
                d.setDate(d.getDate() + e.delaiJours);
                return d;
              })(),
            })),
          },
        },
        include: { etapes: { orderBy: { ordre: "asc" } } },
      });

      // 3. Passer la candidature en INTEGRATION si elle était ACCEPTE
      if (candidature.statut === "ACCEPTE") {
        await tx.candidature.update({
          where: { id: Number(candidatureId) },
          data:  { statut: "INTEGRATION" },
        });
      }

      return { profilRH, onboarding };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/onboarding", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
