import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { DOSSIER_ROUTAGE_FIXE, commissionLabel } from "@/lib/commissionsRIA";
import { TypeCommissionRIA, TypeDossierIC } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut               = searchParams.get("statut");
    const type                 = searchParams.get("type");
    const commissionEmettrice  = searchParams.get("commissionEmettrice") as TypeCommissionRIA | null;
    const commissionReceptrice = searchParams.get("commissionReceptrice") as TypeCommissionRIA | null;

    const dossiers = await prisma.dossierInterCommission.findMany({
      where: {
        ...(statut               ? { statut: statut as never }               : {}),
        ...(type                 ? { type: type as TypeDossierIC }            : {}),
        ...(commissionEmettrice  ? { commissionEmettrice }                    : {}),
        ...(commissionReceptrice ? { commissionReceptrice }                   : {}),
      },
      include: {
        creePar:   { select: { id: true, nom: true, prenom: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
        _count:    { select: { echanges: true, versions: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ dossiers });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const {
      type, titre, description,
      montantDemande, contenuInitial,
    } = body;

    if (!type || !titre) {
      return NextResponse.json({ error: "type et titre requis" }, { status: 400 });
    }

    // ── Routage CDC ──────────────────────────────────────────────────────────
    // Même en supervision, le circuit imposé (DEMANDE_FINANCEMENT : Opérations →
    // Finance) prime : les commissions sont forcées à la route canonique.
    const routageFixe = DOSSIER_ROUTAGE_FIXE[type as TypeDossierIC];
    const commissionEmettrice: TypeCommissionRIA = routageFixe?.emettrice ?? body.commissionEmettrice;
    const commissionReceptrice: TypeCommissionRIA = routageFixe?.receptrice ?? body.commissionReceptrice;

    if (!commissionEmettrice || !commissionReceptrice) {
      return NextResponse.json({ error: "commissionEmettrice et commissionReceptrice requis" }, { status: 400 });
    }
    if (commissionEmettrice === commissionReceptrice) {
      return NextResponse.json({ error: "Les commissions émettrice et réceptrice doivent être différentes" }, { status: 400 });
    }
    if (
      routageFixe &&
      ((body.commissionEmettrice && body.commissionEmettrice !== routageFixe.emettrice) ||
        (body.commissionReceptrice && body.commissionReceptrice !== routageFixe.receptrice))
    ) {
      return NextResponse.json(
        {
          error: `Un dossier « ${type} » doit obligatoirement être émis par ${commissionLabel(routageFixe.emettrice)} vers ${commissionLabel(routageFixe.receptrice)} (cahier des charges).`,
        },
        { status: 400 }
      );
    }

    // Référence auto DIC-2026-00001
    const count = await prisma.dossierInterCommission.count();
    const annee = new Date().getFullYear();
    const reference = `DIC-${annee}-${String(count + 1).padStart(5, "0")}`;

    const dossier = await prisma.$transaction(async (tx) => {
      const d = await tx.dossierInterCommission.create({
        data: {
          reference,
          type:                type as TypeDossierIC,
          titre,
          description,
          commissionEmettrice,
          commissionReceptrice,
          montantDemande:       montantDemande ? Number(montantDemande) : null,
          creeParId:            parseInt(session.user.id),
          statut:               "EN_PREPARATION",
          versionCourante:      1,
        },
      });

      // Créer la version initiale
      await tx.versionDossierIC.create({
        data: {
          dossierId:    d.id,
          version:      1,
          contenu:      contenuInitial ?? { titre, description, montantDemande },
          motif:        "Création initiale",
          modifieParId: parseInt(session.user.id),
        },
      });

      return d;
    });

    return NextResponse.json(dossier, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
