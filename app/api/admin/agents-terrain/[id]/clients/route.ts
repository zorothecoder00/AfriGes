import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/agents-terrain/[id]/clients
 * Clients affectés à un agent avec leurs coordonnées GPS
 * [id] = memberId de l'agent
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { id } = await params;
    const agentId = Number(id);
    if (isNaN(agentId)) return NextResponse.json({ message: 'ID invalide' }, { status: 400 });

    const clients = await prisma.client.findMany({
      where: { agentTerrainId: agentId },
      select: {
        id: true, nom: true, prenom: true, telephone: true,
        codeClient: true, etat: true, quartier: true, ville: true,
        latitude: true, longitude: true,
        niveauRisque: true,
        _count: { select: { souscriptionsPacks: true } },
      },
      orderBy: { nom: 'asc' },
    });

    return NextResponse.json({ data: clients, total: clients.length });
  } catch (error) {
    console.error('GET /api/admin/agents-terrain/[id]/clients', error);
    return NextResponse.json({ message: 'Erreur récupération clients' }, { status: 500 });
  }
}
