import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/ria/reporting/[id]
 * Retourne le rapport mensuel détaillé (données JSON complètes).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const rapportId = parseInt(id);
    if (isNaN(rapportId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const rapport = await prisma.rapportMensuelRIA.findUnique({
      where: { id: rapportId },
      include: {
        portefeuille: {
          select: {
            id: true,
            reference: true,
            nom: true,
            capitalInvesti: true,
            capitalDisponible: true,
            capitalEngage: true,
            capitalRecouvre: true,
            beneficesGeneres: true,
            beneficesDistribues: true,
            fondSecurite: true,
            profilRIA: {
              select: {
                gestionnaire: {
                  select: { member: { select: { nom: true, prenom: true, email: true, telephone: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!rapport) return NextResponse.json({ error: "Rapport introuvable" }, { status: 404 });

    return NextResponse.json({ rapport });
  } catch (error) {
    console.error("GET /api/admin/ria/reporting/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
