import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const presences = await prisma.presenceReunionRIA.findMany({
      where: { reunionId: parseInt(id) },
      include: {
        membre: {
          include: {
            user: { select: { id: true, nom: true, prenom: true } },
          },
        },
      },
    });

    return NextResponse.json({ presences });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// body: [{ membreId, present, procuration, notes }]
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reunionId = parseInt(id);
    const body = await req.json();
    const { presencesData } = body as {
      presencesData: { membreId: number; present: boolean; procuration?: boolean; notes?: string }[];
    };

    if (!Array.isArray(presencesData)) {
      return NextResponse.json({ error: "presencesData (array) requis" }, { status: 400 });
    }

    await prisma.$transaction(
      presencesData.map((p) =>
        prisma.presenceReunionRIA.upsert({
          where: { reunionId_membreId: { reunionId, membreId: p.membreId } },
          create: { reunionId, membreId: p.membreId, present: p.present, procuration: p.procuration ?? false, notes: p.notes },
          update: { present: p.present, procuration: p.procuration ?? false, notes: p.notes },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
