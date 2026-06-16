import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const dossier = await prisma.dossierInterCommission.findUnique({
      where: { id: parseInt(id) },
      include: {
        creePar:   { select: { id: true, nom: true, prenom: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
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
    return NextResponse.json(dossier);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Actions du workflow : TRANSMETTRE | VALIDER_RECEPTION | APPROUVER | REJETER | DEMANDER_AJUSTEMENT | EXECUTER
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const dossierId = parseInt(id);
    const body = await req.json();
    const {
      action, montantApprouve, commentaire,
      contenuRevise, motifRevision,
      titre, description, montantDemande,
    } = body;

    // Transitions de statut
    const transitions: Record<string, string> = {
      TRANSMETTRE:         "TRANSMIS",
      VALIDER_RECEPTION:   "RECU",
      METTRE_EN_ANALYSE:   "EN_ANALYSE",
      METTRE_EN_ATTENTE:   "EN_ATTENTE_DECISION",
      APPROUVER:           "APPROUVE",
      REJETER:             "REJETE",
      DEMANDER_AJUSTEMENT: "TRANSMIS",   // retourne à l'émettrice avec observations
      EXECUTER:            "EXECUTE",
    };

    const dossier = await prisma.$transaction(async (tx) => {
      const current = await tx.dossierInterCommission.findUnique({
        where: { id: dossierId },
        select: { statut: true, versionCourante: true },
      });
      if (!current) throw new Error("DOSSIER_NOT_FOUND");

      const data: Record<string, unknown> = {};

      if (action && transitions[action]) {
        data.statut = transitions[action];
        if (action === "APPROUVER") {
          data.valideParId    = parseInt(session.user.id);
          data.dateValidation = new Date();
          if (montantApprouve !== undefined) data.montantApprouve = Number(montantApprouve);
        }
      }

      // Mise à jour des champs éditables (uniquement si EN_PREPARATION ou retour pour correction)
      if (titre       !== undefined) data.titre       = titre;
      if (description !== undefined) data.description = description;
      if (montantDemande !== undefined) data.montantDemande = Number(montantDemande);

      // Si révision du contenu → créer une nouvelle version
      if (contenuRevise !== undefined) {
        const newVersion = (current.versionCourante ?? 1) + 1;
        data.versionCourante = newVersion;
        await tx.versionDossierIC.create({
          data: {
            dossierId,
            version:      newVersion,
            contenu:      contenuRevise,
            motif:        motifRevision ?? action ?? "Révision",
            modifieParId: parseInt(session.user.id),
          },
        });
      }

      // Ajouter un échange si commentaire fourni
      if (commentaire) {
        const d = await tx.dossierInterCommission.findUnique({
          where: { id: dossierId },
          select: { commissionEmettrice: true, commissionReceptrice: true },
        });
        await tx.echangeInterCommission.create({
          data: {
            dossierId,
            auteurId:   parseInt(session.user.id),
            commission: d!.commissionReceptrice,
            type:       action === "REJETER"             ? "REJET"
                      : action === "DEMANDER_AJUSTEMENT" ? "DEMANDE_AJUSTEMENT"
                      : action === "APPROUVER"           ? "VALIDATION"
                      : "OBSERVATION",
            contenu: commentaire,
          },
        });
      }

      return tx.dossierInterCommission.update({
        where: { id: dossierId },
        data,
        include: {
          creePar:   { select: { id: true, nom: true, prenom: true } },
          validePar: { select: { id: true, nom: true, prenom: true } },
        },
      });
    });

    return NextResponse.json(dossier);
  } catch (e) {
    if ((e as Error).message === "DOSSIER_NOT_FOUND") {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
