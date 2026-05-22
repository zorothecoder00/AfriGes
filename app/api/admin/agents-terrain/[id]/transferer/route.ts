import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/agents-terrain/[id]/transferer
 * Transfère tout le portefeuille d'un agent vers un autre
 * Body: { versAgentId: number, clientIds?: number[] }
 *   - clientIds absent ou vide = transfert total
 *   - clientIds fournis = transfert partiel
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { id } = await params;
    const agentSourceId = Number(id);   // memberId de l'agent source
    if (isNaN(agentSourceId)) return NextResponse.json({ message: 'ID invalide' }, { status: 400 });

    const body = await req.json();
    const { versAgentId, clientIds } = body as { versAgentId: number; clientIds?: number[] };

    if (!versAgentId) return NextResponse.json({ message: 'versAgentId requis' }, { status: 400 });
    if (agentSourceId === Number(versAgentId)) {
      return NextResponse.json({ message: 'Source et destination identiques' }, { status: 400 });
    }

    // Vérifier que les deux sont bien des agents terrain
    const [source, dest] = await Promise.all([
      prisma.gestionnaire.findFirst({ where: { memberId: agentSourceId, role: 'AGENT_TERRAIN' } }),
      prisma.gestionnaire.findFirst({ where: { memberId: Number(versAgentId), role: 'AGENT_TERRAIN' } }),
    ]);
    if (!source) return NextResponse.json({ message: 'Agent source introuvable' }, { status: 404 });
    if (!dest)   return NextResponse.json({ message: 'Agent destination introuvable' }, { status: 404 });

    const whereClients = {
      agentTerrainId: agentSourceId,
      ...(clientIds?.length ? { id: { in: clientIds } } : {}),
    };

    const result = await prisma.$transaction(async (tx) => {
      // Nombre de clients concernés
      const clients = await tx.client.findMany({
        where: whereClients,
        select: { id: true },
      });

      if (clients.length === 0) {
        throw new Error('AUCUN_CLIENT');
      }

      const clientIdsList = clients.map((c) => c.id);

      // 1. Clore les affectations actives vers l'agent source
      await tx.clientAgentAffectation.updateMany({
        where: { clientId: { in: clientIdsList }, agentId: agentSourceId, actif: true },
        data:  { actif: false, dateFin: new Date() },
      });

      // 2. Créer les nouvelles affectations vers l'agent destination
      await tx.clientAgentAffectation.createMany({
        data: clientIdsList.map((cid) => ({
          clientId: cid,
          agentId:  Number(versAgentId),
          actif:    true,
        })),
      });

      // 3. Mettre à jour le champ direct agentTerrainId sur les clients
      await tx.client.updateMany({
        where: { id: { in: clientIdsList } },
        data:  { agentTerrainId: Number(versAgentId) },
      });

      // 4. Audit log
      await tx.auditLog.create({
        data: {
          action:   'TRANSFERT_PORTEFEUILLE',
          entite:   'Client',
          userId:   Number(session.user.id),
        },
      });

      return { nbTransferes: clientIdsList.length };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error('POST /api/admin/agents-terrain/[id]/transferer', error);
    if (error instanceof Error && error.message === 'AUCUN_CLIENT') {
      return NextResponse.json({ message: 'Aucun client à transférer' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Erreur lors du transfert' }, { status: 500 });
  }
}
