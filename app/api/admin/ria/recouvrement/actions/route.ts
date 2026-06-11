import { NextRequest, NextResponse } from "next/server";
import { TypeActionRecouvrement, StatutActionRecouvrement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const financementId = searchParams.get("financementId");
    const statut        = searchParams.get("statut");
    const type          = searchParams.get("type");

    const actions = await prisma.actionRecouvrementRIA.findMany({
      where: {
        ...(financementId ? { financementId: parseInt(financementId) } : {}),
        ...(statut ? { statut: statut as StatutActionRecouvrement } : {}),
        ...(type   ? { type:   type   as TypeActionRecouvrement  } : {}),
      },
      include: {
        effectuePar: { select: { nom: true, prenom: true } },
        financement: {
          select: {
            id:        true,
            reference: true,
            statut:    true,
            encours:   true,
            client:    { select: { nom: true, prenom: true } },
            portefeuille: {
              select: {
                reference: true,
                nom:       true,
                profilRIA: {
                  select: {
                    gestionnaire: {
                      select: { member: { select: { nom: true, prenom: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { dateAction: "desc" },
      take: 200,
    });

    return NextResponse.json({ data: actions });
  } catch (error) {
    console.error("GET /api/admin/ria/recouvrement/actions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { financementId, type, notes, resultat, dateRelance, statut } = body;

    if (!financementId || !type) {
      return NextResponse.json({ error: "financementId et type sont requis" }, { status: 400 });
    }

    const financement = await prisma.operationFinancementRIA.findUnique({
      where: { id: financementId },
    });
    if (!financement) {
      return NextResponse.json({ error: "Financement introuvable" }, { status: 404 });
    }

    const action = await prisma.actionRecouvrementRIA.create({
      data: {
        financementId,
        type:          type as TypeActionRecouvrement,
        statut:        (statut as StatutActionRecouvrement) ?? "EN_COURS",
        notes:         notes  ?? null,
        resultat:      resultat ?? null,
        effectueParId: parseInt(session.user.id as string),
        dateRelance:   dateRelance ? new Date(dateRelance) : null,
      },
      include: {
        effectuePar: { select: { nom: true, prenom: true } },
      },
    });

    return NextResponse.json({ data: action }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/ria/recouvrement/actions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
