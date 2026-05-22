import { NextResponse } from 'next/server';
import { StatutVisite } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/agents-terrain/[id]/visites
 * ?dateDebut=&dateFin=&clientId=
 * Historique des visites d'un agent (tracé tournée)
 * [id] = memberId de l'agent
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { id } = await params;
    const agentId = Number(id);
    if (isNaN(agentId)) return NextResponse.json({ message: 'ID invalide' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const dateDebut = searchParams.get('dateDebut');
    const dateFin   = searchParams.get('dateFin');
    const clientId  = searchParams.get('clientId');

    const visites = await prisma.visiteClient.findMany({
      where: {
        agentId,
        ...(clientId && { clientId: Number(clientId) }),
        ...(dateDebut || dateFin ? {
          dateVisite: {
            ...(dateDebut && { gte: new Date(dateDebut) }),
            ...(dateFin   && { lte: new Date(new Date(dateFin).setHours(23, 59, 59, 999)) }),
          },
        } : {}),
      },
      select: {
        id: true, statut: true, latitude: true, longitude: true,
        dateVisite: true, notes: true,
        client: { select: { id: true, nom: true, prenom: true, telephone: true, codeClient: true } },
      },
      orderBy: { dateVisite: 'asc' },
    });

    return NextResponse.json({ data: visites, total: visites.length });
  } catch (error) {
    console.error('GET /api/admin/agents-terrain/[id]/visites', error);
    return NextResponse.json({ message: 'Erreur récupération visites' }, { status: 500 });
  }
}

/**
 * POST /api/admin/agents-terrain/[id]/visites
 * Enregistrer une visite client
 * Body: { clientId, latitude?, longitude?, notes?, statut?, dateVisite? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { id } = await params;
    const agentId = Number(id);
    if (isNaN(agentId)) return NextResponse.json({ message: 'ID invalide' }, { status: 400 });

    const body = await req.json();
    const { clientId, latitude, longitude, notes, statut, dateVisite } = body;

    if (!clientId) return NextResponse.json({ message: 'clientId requis' }, { status: 400 });

    // Vérifier que le client est bien affecté à cet agent
    const client = await prisma.client.findFirst({
      where: { id: Number(clientId), agentTerrainId: agentId },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ message: 'Ce client n\'est pas affecté à cet agent' }, { status: 422 });
    }

    const visite = await prisma.visiteClient.create({
      data: {
        agentId,
        clientId:  Number(clientId),
        statut:    (statut as StatutVisite) ?? StatutVisite.REALISEE,
        latitude:  latitude  != null ? Number(latitude)  : null,
        longitude: longitude != null ? Number(longitude) : null,
        notes:     notes || null,
        dateVisite: dateVisite ? new Date(dateVisite) : new Date(),
      },
      include: {
        client: { select: { id: true, nom: true, prenom: true } },
      },
    });

    return NextResponse.json({ data: visite }, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/agents-terrain/[id]/visites', error);
    return NextResponse.json({ message: 'Erreur enregistrement visite' }, { status: 500 });
  }
}
