import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

/**
 * GET /api/admin/notifications?scope=clientele&lue=false&page=1
 * POST /api/admin/notifications/lire { ids: number[] }  — marquer comme lues
 */

const CLIENTELE_PREFIXES = [
  '/dashboard/admin/clients',
  '/dashboard/admin/creances',
  '/dashboard/admin/collectes',
  '/dashboard/admin/remboursements',
  '/dashboard/admin/agents-terrain',
  '/dashboard/admin/alertes-impayes',
  '/dashboard/admin/clientele',
];

export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const scope    = searchParams.get('scope');         // 'clientele' | null
    const lueParam = searchParams.get('lue');           // 'true' | 'false' | null
    const page     = Math.max(1, Number(searchParams.get('page')  ?? '1'));
    const limit    = Math.min(50, Number(searchParams.get('limit') ?? '20'));

    const lueFilter = lueParam === 'true' ? true : lueParam === 'false' ? false : undefined;

    const scopeFilter = scope === 'clientele'
      ? { OR: CLIENTELE_PREFIXES.map((p) => ({ actionUrl: { startsWith: p } })) }
      : {};

    const [notifications, total, nbNonLues] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId: Number(session.user.id),
          ...(lueFilter !== undefined && { lue: lueFilter }),
          ...scopeFilter,
        },
        orderBy: { createdAt: 'desc' },
        skip:  (page - 1) * limit,
        take:  limit,
      }),

      prisma.notification.count({
        where: {
          userId: Number(session.user.id),
          ...(lueFilter !== undefined && { lue: lueFilter }),
          ...scopeFilter,
        },
      }),

      prisma.notification.count({
        where: {
          userId: Number(session.user.id),
          lue:    false,
          ...scopeFilter,
        },
      }),
    ]);

    return NextResponse.json({
      data: notifications,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1, nbNonLues },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erreur notifications' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const body = await req.json();
    const ids: number[] = body.ids ?? [];   // vide = marquer toutes comme lues
    const scope: string = body.scope ?? ''; // 'clientele' = scope restreint

    const scopeFilter = scope === 'clientele'
      ? { OR: CLIENTELE_PREFIXES.map((p) => ({ actionUrl: { startsWith: p } })) }
      : {};

    if (ids.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: Number(session.user.id) },
        data:  { lue: true, dateLecture: new Date() },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: Number(session.user.id), lue: false, ...scopeFilter },
        data:  { lue: true, dateLecture: new Date() },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erreur marquer lu' }, { status: 500 });
  }
}
