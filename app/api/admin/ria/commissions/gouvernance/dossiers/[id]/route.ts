import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { peutOutrepasserGating } from "@/lib/authCommissionRIA";
import { calculerAnalyseFinancement, type ContenuDemandeFinancement } from "@/lib/riaAnalyseDossier";
import { appliquerActionDossier, DossierWorkflowError, type DossierAction } from "@/lib/dossierInterCommissionWorkflow";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const dossier = await prisma.dossierInterCommission.findUnique({
      where: { id: parseInt(id) },
      include: {
        creePar: { select: { id: true, nom: true, prenom: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
        portefeuilleExecution: { select: { id: true, reference: true, nom: true, capitalDisponible: true } },
        versions: {
          include: { modifiePar: { select: { id: true, nom: true, prenom: true } } },
          orderBy: { version: "desc" },
        },
        echanges: {
          include: { auteur: { select: { id: true, nom: true, prenom: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!dossier) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });

    let analyse = null;
    if (dossier.type === "DEMANDE_FINANCEMENT") {
      const versionCourante = dossier.versions.find((v) => v.version === dossier.versionCourante);
      const contenu = (versionCourante?.contenu ?? {}) as ContenuDemandeFinancement;
      const portefeuilleId = dossier.portefeuilleExecutionId ?? contenu.investisseursConcernes?.[0] ?? null;
      analyse = await calculerAnalyseFinancement(prisma, contenu, portefeuilleId);
    }

    return NextResponse.json({ ...dossier, analyse });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Actions du workflow : TRANSMETTRE | VALIDER_RECEPTION | METTRE_EN_ANALYSE | METTRE_EN_ATTENTE
//                       | APPROUVER | REJETER | DEMANDER_AJUSTEMENT | EXECUTER
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();

    const dossier = await prisma.$transaction((tx) =>
      appliquerActionDossier(tx, {
        dossierId: parseInt(id),
        userId: parseInt(session.user.id),
        action: body.action as DossierAction | undefined,
        montantApprouve: body.montantApprouve,
        portefeuilleExecutionId: body.portefeuilleExecutionId,
        contenuRevise: body.contenuRevise,
        motifRevision: body.motifRevision,
        commentaire: body.commentaire,
        titre: body.titre,
        description: body.description,
        montantDemande: body.montantDemande,
        // Supervision globale en lecture, action via siège : un admin/RESPONSABLE_RIA
        // n'agit dans le workflow que s'il détient le rôle requis dans la commission.
        // Seul le SUPER_ADMIN conserve une soupape d'outrepassement.
        skipGating: peutOutrepasserGating(session.user.role),
      })
    );

    return NextResponse.json(dossier);
  } catch (e) {
    if (e instanceof DossierWorkflowError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
