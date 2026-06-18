import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";
import { DOSSIER_ROUTAGE_FIXE, commissionLabel } from "@/lib/commissionsRIA";
import { TypeCommissionRIA, TypeDossierIC } from "@prisma/client";

// Dossiers inter-commissions liés aux commissions du membre connecté
export async function GET(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    const { searchParams } = new URL(req.url);
    const sens   = searchParams.get("sens");   // "emis" | "recus"
    const statut = searchParams.get("statut");

    const memberships = await prisma.membreCommissionRIA.findMany({
      where: { userId, actif: true },
      select: { typeCommission: true },
    });
    const types = memberships.map((m) => m.typeCommission);

    const dossiers = await prisma.dossierInterCommission.findMany({
      where: {
        ...(sens === "emis"  ? { commissionEmettrice:  { in: types } } : {}),
        ...(sens === "recus" ? { commissionReceptrice: { in: types } } : {}),
        ...(sens === null    ? { OR: [{ commissionEmettrice: { in: types } }, { commissionReceptrice: { in: types } }] } : {}),
        ...(statut           ? { statut: statut as never }              : {}),
      },
      include: {
        creePar: { select: { id: true, nom: true, prenom: true } },
        _count:  { select: { echanges: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ dossiers });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Création d'un dossier — la commission émettrice doit être une commission active du créateur
export async function POST(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    const body = await req.json();
    const {
      type, titre, description,
      montantDemande, contenuInitial,
    } = body;

    if (!type || !titre) {
      return NextResponse.json({ error: "type et titre requis" }, { status: 400 });
    }

    // ── Routage CDC ──────────────────────────────────────────────────────────
    // Si le type a une trajectoire imposée (ex. DEMANDE_FINANCEMENT : Opérations
    // → Finance), on force les commissions à cette route quel que soit l'input
    // client : un membre ne peut PAS émettre un financement au nom d'une autre
    // commission ni le router ailleurs que vers Finance.
    const routageFixe = DOSSIER_ROUTAGE_FIXE[type as TypeDossierIC];
    const commissionEmettrice: TypeCommissionRIA = routageFixe?.emettrice ?? body.commissionEmettrice;
    const commissionReceptrice: TypeCommissionRIA = routageFixe?.receptrice ?? body.commissionReceptrice;

    if (!commissionEmettrice || !commissionReceptrice) {
      return NextResponse.json({ error: "commissionEmettrice et commissionReceptrice requis" }, { status: 400 });
    }
    if (commissionEmettrice === commissionReceptrice) {
      return NextResponse.json({ error: "Les commissions émettrice et réceptrice doivent être différentes" }, { status: 400 });
    }
    // Si un routage non conforme a été demandé explicitement, on le signale clairement.
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

    // Préparation d'un dossier (CDC) : réservée au Président / Rapporteurs de la
    // commission émettrice. (auth.commission === null → admin/RESPONSABLE_RIA, pas de restriction)
    if (auth.commission !== null) {
      const membre = await prisma.membreCommissionRIA.findFirst({
        where: { userId, typeCommission: commissionEmettrice, actif: true },
        select: { role: true },
      });
      if (!membre) {
        return NextResponse.json({ error: "Vous devez être membre actif de la commission émettrice" }, { status: 403 });
      }
      if (!["PRESIDENT", "RAPPORTEUR_1", "RAPPORTEUR_2"].includes(membre.role)) {
        return NextResponse.json({ error: "Seuls le Président et les Rapporteurs peuvent préparer un dossier" }, { status: 403 });
      }
    }

    const count = await prisma.dossierInterCommission.count();
    const annee = new Date().getFullYear();
    const reference = `DIC-${annee}-${String(count + 1).padStart(5, "0")}`;

    const dossier = await prisma.$transaction(async (tx) => {
      const d = await tx.dossierInterCommission.create({
        data: {
          reference,
          type: type as TypeDossierIC,
          titre,
          description,
          commissionEmettrice,
          commissionReceptrice,
          montantDemande:       montantDemande ? Number(montantDemande) : null,
          creeParId:            userId,
          statut:               "EN_PREPARATION",
          versionCourante:      1,
        },
      });

      await tx.versionDossierIC.create({
        data: {
          dossierId:    d.id,
          version:      1,
          contenu:      contenuInitial ?? { titre, description, montantDemande },
          motif:        "Création initiale",
          modifieParId: userId,
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
