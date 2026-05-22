import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

// Entités du module clientèle
const ENTITES_CLIENTELE = [
  'Client', 'SouscriptionPack', 'CollecteJournaliere',
  'VersementPack', 'VenteDirecte', 'EcheancePack',
];

const ACTION_LABELS: Record<string, string> = {
  CREATION_CLIENT:       'Création client',
  MODIFICATION_CLIENT:   'Modification client',
  SUPPRESSION_CLIENT:    'Suppression client',
  CREATION_COLLECTE:     'Création collecte',
  VALIDATION_COLLECTE:   'Validation collecte',
  ANNULATION_COLLECTE:   'Annulation collecte',
  CREATION_VERSEMENT:    'Versement pack',
  CREATION_SOUSCRIPTION: 'Souscription pack',
};

/**
 * GET /api/admin/audit
 * Historique des opérations du module clientèle
 * ?entite=Client&action=&userId=&dateDebut=&dateFin=&page=1&limit=30
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const entite    = searchParams.get('entite') || '';
    const action    = (searchParams.get('action') || '').trim();
    const userId    = searchParams.get('userId');
    const dateDebut = searchParams.get('dateDebut');
    const dateFin   = searchParams.get('dateFin');
    const page      = Number(searchParams.get('page') || 1);
    const limit     = Number(searchParams.get('limit') || 30);
    const skip      = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      entite: entite
        ? entite
        : { in: ENTITES_CLIENTELE },
      ...(action && { action: { contains: action, mode: 'insensitive' } }),
      ...(userId && { userId: Number(userId) }),
      ...(dateDebut || dateFin ? {
        createdAt: {
          ...(dateDebut && { gte: new Date(dateDebut) }),
          ...(dateFin   && { lte: new Date(new Date(dateFin).setHours(23, 59, 59, 999)) }),
        },
      } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, nom: true, prenom: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Stats rapides
    const [parEntite, parAction] = await Promise.all([
      prisma.auditLog.groupBy({
        by:    ['entite'],
        where: { entite: { in: ENTITES_CLIENTELE } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.auditLog.groupBy({
        by:    ['action'],
        where: { entite: { in: ENTITES_CLIENTELE } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      data: logs.map((l) => ({
        id:       l.id,
        action:   l.action,
        actionLabel: ACTION_LABELS[l.action] ?? l.action.replace(/_/g, ' '),
        entite:   l.entite,
        entiteId: l.entiteId,
        createdAt: l.createdAt,
        user: l.user
          ? { id: l.user.id, nom: `${l.user.prenom} ${l.user.nom}`, email: l.user.email }
          : null,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      stats: { parEntite, parAction },
      entitesDisponibles: ENTITES_CLIENTELE,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erreur audit' }, { status: 500 });
  }
}
