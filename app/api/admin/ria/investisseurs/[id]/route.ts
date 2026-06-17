import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

type Ctx = { params: Promise<{ id: string }> };

// ── GET — fiche investisseur complète ─────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const userId = parseInt(id);

    const gestionnaire = await prisma.gestionnaire.findFirst({
      where: { memberId: userId, OR: [{ role: "INVESTISSEUR_RIA" }, { profilRIA: { isNot: null } }] },
      include: {
        member: {
          select: { id: true, nom: true, prenom: true, email: true, telephone: true, photo: true, adresse: true, etat: true, dateAdhesion: true },
        },
        profilRIA: {
          include: {
            portefeuilles: {
              orderBy: { createdAt: "asc" },
              include: {
                depots:    { orderBy: { createdAt: "desc" }, take: 5 },
                retraits:  { orderBy: { createdAt: "desc" }, take: 5 },
                financements: {
                  where: { statut: { in: ["ACTIF", "EN_RETARD"] } },
                  orderBy: { dateFinancement: "desc" },
                  take: 10,
                  include: { client: { select: { id: true, nom: true, prenom: true, telephone: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!gestionnaire) return NextResponse.json({ error: "Investisseur introuvable" }, { status: 404 });

    return NextResponse.json({ data: gestionnaire });
  } catch (error) {
    console.error("GET /api/admin/ria/investisseurs/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ── PATCH — modifier profil investisseur ──────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const userId = parseInt(id);
    const body = await req.json();
    const { nom, prenom, telephone, adresse, profession, pays, pieceIdentiteUrl, notes } = body;

    const gestionnaire = await prisma.gestionnaire.findFirst({
      where: { memberId: userId, OR: [{ role: "INVESTISSEUR_RIA" }, { profilRIA: { isNot: null } }] },
      include: { profilRIA: true },
    });
    if (!gestionnaire) return NextResponse.json({ error: "Investisseur introuvable" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      if (nom || prenom || telephone !== undefined || adresse !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(nom    ? { nom }    : {}),
            ...(prenom ? { prenom } : {}),
            ...(telephone !== undefined ? { telephone } : {}),
            ...(adresse   !== undefined ? { adresse }   : {}),
          },
        });
      }

      if (gestionnaire.profilRIA) {
        await tx.profilInvestisseurRIA.update({
          where: { id: gestionnaire.profilRIA.id },
          data: {
            ...(profession       !== undefined ? { profession }       : {}),
            ...(pays             !== undefined ? { pays }             : {}),
            ...(pieceIdentiteUrl !== undefined ? { pieceIdentiteUrl } : {}),
            ...(notes            !== undefined ? { notes }            : {}),
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/admin/ria/investisseurs/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
