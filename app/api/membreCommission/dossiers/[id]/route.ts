import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession, peutOutrepasserGating } from "@/lib/authCommissionRIA";
import { calculerAnalyseFinancement, construireConsultation, type ContenuDemandeFinancement } from "@/lib/riaAnalyseDossier";
import { appliquerActionDossier, DossierWorkflowError, type DossierAction } from "@/lib/dossierInterCommissionWorkflow";

type Ctx = { params: Promise<{ id: string }> };

async function aAccesDossier(
  userId: number,
  isAdmin: boolean,
  dossier: { commissionEmettrice: string; commissionReceptrice: string }
) {
  if (isAdmin) return true;
  const membre = await prisma.membreCommissionRIA.findFirst({
    where: {
      userId,
      actif: true,
      typeCommission: { in: [dossier.commissionEmettrice, dossier.commissionReceptrice] as never },
    },
  });
  return !!membre;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const userId = parseInt(auth.session.user.id);

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

    if (!(await aAccesDossier(userId, auth.commission === null, dossier))) {
      return NextResponse.json({ error: "Accès refusé à ce dossier" }, { status: 403 });
    }

    let analyse = null;
    let consultation = null;
    if (dossier.type === "DEMANDE_FINANCEMENT") {
      const versionCourante = dossier.versions.find((v) => v.version === dossier.versionCourante);
      const contenu = (versionCourante?.contenu ?? {}) as ContenuDemandeFinancement;
      const portefeuilleId = dossier.portefeuilleExecutionId ?? contenu.investisseursConcernes?.[0] ?? null;
      analyse = await calculerAnalyseFinancement(prisma, contenu, portefeuilleId);
      consultation = await construireConsultation(prisma, contenu);
    }

    // Rôle de l'appelant dans les commissions du dossier (pour masquer les actions
    // non autorisées côté UI). superviseur = override ADMIN/SUPER_ADMIN.
    const sieges = await prisma.membreCommissionRIA.findMany({
      where: {
        userId, actif: true,
        typeCommission: { in: [dossier.commissionEmettrice, dossier.commissionReceptrice] },
      },
      select: { typeCommission: true, role: true },
    });
    const monRoleEmettrice = sieges.find((s) => s.typeCommission === dossier.commissionEmettrice)?.role ?? null;
    const monRoleReceptrice = sieges.find((s) => s.typeCommission === dossier.commissionReceptrice)?.role ?? null;
    const superviseur = peutOutrepasserGating(auth.session.user.role);

    return NextResponse.json({ ...dossier, analyse, consultation, monRoleEmettrice, monRoleReceptrice, superviseur });
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
    const userId = parseInt(auth.session.user.id);
    const dossierId = parseInt(id);
    const body = await req.json();

    const existant = await prisma.dossierInterCommission.findUnique({
      where: { id: dossierId },
      select: { commissionEmettrice: true, commissionReceptrice: true },
    });
    if (!existant) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });

    const isAdmin = auth.commission === null;
    if (!(await aAccesDossier(userId, isAdmin, existant))) {
      return NextResponse.json({ error: "Accès refusé à ce dossier" }, { status: 403 });
    }

    const dossier = await prisma.$transaction((tx) =>
      appliquerActionDossier(tx, {
        dossierId,
        userId,
        action: body.action as DossierAction | undefined,
        montantApprouve: body.montantApprouve,
        portefeuilleExecutionId: body.portefeuilleExecutionId,
        contenuRevise: body.contenuRevise,
        motifRevision: body.motifRevision,
        commentaire: body.commentaire,
        titre: body.titre,
        description: body.description,
        montantDemande: body.montantDemande,
        // Accès au dossier accordé (supervision) mais l'action reste gatée par le
        // rôle réel dans la commission ; seul le SUPER_ADMIN peut outrepasser.
        skipGating: peutOutrepasserGating(auth.session.user.role),
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
