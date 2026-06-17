import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";
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
      commissionEmettrice, commissionReceptrice,
      montantDemande, contenuInitial,
    } = body;

    if (!type || !titre || !commissionEmettrice || !commissionReceptrice) {
      return NextResponse.json({ error: "type, titre, commissionEmettrice et commissionReceptrice requis" }, { status: 400 });
    }
    if (commissionEmettrice === commissionReceptrice) {
      return NextResponse.json({ error: "Les commissions émettrice et réceptrice doivent être différentes" }, { status: 400 });
    }

    // Un membre standard ne peut créer un dossier que pour une commission dont il est membre actif.
    // (auth.commission === null → admin/RESPONSABLE_RIA, pas de restriction)
    if (auth.commission !== null) {
      const estMembre = await prisma.membreCommissionRIA.findFirst({
        where: { userId, typeCommission: commissionEmettrice as TypeCommissionRIA, actif: true },
      });
      if (!estMembre) {
        return NextResponse.json({ error: "Vous devez être membre actif de la commission émettrice" }, { status: 403 });
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
          commissionEmettrice:  commissionEmettrice  as TypeCommissionRIA,
          commissionReceptrice: commissionReceptrice as TypeCommissionRIA,
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
