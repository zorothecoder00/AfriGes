import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession, getRoleMembre, ROLES_PREPARATION_REUNION } from "@/lib/authCommissionRIA";
import { genererSalleVisio } from "@/lib/visioReunion";
import { TypeCommissionRIA } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");

    // Récupérer les commissions du membre
    const memberships = await prisma.membreCommissionRIA.findMany({
      where: { userId, actif: true },
      select: { typeCommission: true, id: true },
    });
    const types = memberships.map((m) => m.typeCommission);

    const reunions = await prisma.reunionCommissionRIA.findMany({
      where: {
        typeCommission: { in: types },
        ...(statut ? { statut: statut as never } : {}),
      },
      include: {
        organisateur: { select: { id: true, nom: true, prenom: true } },
        presences: {
          where: { membreId: { in: memberships.map((m) => m.id) } },
          select: { present: true, signatureNumerique: true, dateSignature: true },
        },
        compteRenduStr: { select: { id: true, dateValidation: true } },
        _count: { select: { resolutions: true } },
      },
      orderBy: { dateHeure: "desc" },
      take: 50,
    });

    return NextResponse.json({ reunions });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Création / préparation d'une réunion (CDC : Président ou Rapporteur 1 de la commission)
export async function POST(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    const body = await req.json();
    const { typeCommission, titre, dateHeure, lieu, ordreJour, lienVisio } = body;

    if (!typeCommission || !titre || !dateHeure) {
      return NextResponse.json({ error: "typeCommission, titre et dateHeure requis" }, { status: 400 });
    }

    // auth.commission === null → admin/RESPONSABLE_RIA (supervision, pas de gating)
    if (auth.commission !== null) {
      const role = await getRoleMembre(userId, typeCommission as TypeCommissionRIA);
      if (!role) {
        return NextResponse.json({ error: "Vous n'êtes pas membre actif de cette commission" }, { status: 403 });
      }
      if (!ROLES_PREPARATION_REUNION.includes(role)) {
        return NextResponse.json({ error: "La préparation d'une réunion est réservée au Président et au Rapporteur 1" }, { status: 403 });
      }
    }

    const reunion = await prisma.reunionCommissionRIA.create({
      data: {
        typeCommission: typeCommission as TypeCommissionRIA,
        titre,
        dateHeure: new Date(dateHeure),
        lieu: lieu ?? null,
        ordreJour: ordreJour ?? null,
        salleVisio: genererSalleVisio(),
        lienVisio: lienVisio?.trim() || null,
        statut: "PLANIFIEE",
        organisateurId: userId,
      },
      include: { organisateur: { select: { id: true, nom: true, prenom: true } } },
    });

    return NextResponse.json(reunion, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
