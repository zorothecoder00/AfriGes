import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession, getRoleMembre, ROLES_REDACTION_CR } from "@/lib/authCommissionRIA";
import { TypeCommissionRIA } from "@prisma/client";

// Résolutions des commissions du membre connecté (lecture seule).
// Admin / RESPONSABLE_RIA (auth.commission === null) voient toutes les commissions.
export async function GET(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");

    const isAdmin = auth.commission === null;
    let typeFilter = {};
    if (!isAdmin) {
      const memberships = await prisma.membreCommissionRIA.findMany({
        where: { userId, actif: true },
        select: { typeCommission: true },
      });
      typeFilter = { typeCommission: { in: memberships.map((m) => m.typeCommission) } };
    }

    const resolutions = await prisma.resolutionCommRIA.findMany({
      where: {
        ...typeFilter,
        ...(statut ? { statut: statut as never } : {}),
      },
      include: {
        reunion: { select: { id: true, titre: true, dateHeure: true } },
        responsable: { select: { id: true, nom: true, prenom: true } },
        plansAction: { select: { id: true, statut: true, progression: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ resolutions });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Rédaction d'une résolution (CDC : Président ou Rapporteurs). Démarre en EN_PREPARATION.
export async function POST(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    const body = await req.json();
    const { typeCommission, reunionId, titre, description, dateEcheance, responsableId } = body;

    if (!typeCommission || !titre) {
      return NextResponse.json({ error: "typeCommission et titre requis" }, { status: 400 });
    }

    if (auth.commission !== null) {
      const role = await getRoleMembre(userId, typeCommission as TypeCommissionRIA);
      if (!role) return NextResponse.json({ error: "Vous n'êtes pas membre actif de cette commission" }, { status: 403 });
      if (!ROLES_REDACTION_CR.includes(role)) {
        return NextResponse.json({ error: "La rédaction d'une résolution est réservée au Président et aux Rapporteurs" }, { status: 403 });
      }
    }

    const count = await prisma.resolutionCommRIA.count({ where: { typeCommission: typeCommission as TypeCommissionRIA } });
    const prefix = (typeCommission as string).slice(0, 3).toUpperCase();
    const numero = `RES-${prefix}-${String(count + 1).padStart(3, "0")}`;

    const resolution = await prisma.resolutionCommRIA.create({
      data: {
        typeCommission: typeCommission as TypeCommissionRIA,
        reunionId: reunionId ? Number(reunionId) : null,
        numero,
        titre,
        description: description ?? null,
        dateEcheance: dateEcheance ? new Date(dateEcheance) : null,
        responsableId: responsableId ? Number(responsableId) : null,
        statut: "EN_PREPARATION",
      },
      include: { responsable: { select: { id: true, nom: true, prenom: true } } },
    });

    return NextResponse.json(resolution, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
