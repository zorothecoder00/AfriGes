import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/agents-terrain/[id]
 * Modifier zone et/ou statut actif d'un agent terrain
 * Body: { zone?, actif? }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { id } = await params;
    const gestionnaireId = Number(id);
    if (isNaN(gestionnaireId)) return NextResponse.json({ message: 'ID invalide' }, { status: 400 });

    const body = await req.json();
    const { zone, actif } = body;

    const existing = await prisma.gestionnaire.findUnique({ where: { id: gestionnaireId } });
    if (!existing || existing.role !== 'AGENT_TERRAIN') {
      return NextResponse.json({ message: 'Agent introuvable' }, { status: 404 });
    }

    const updated = await prisma.gestionnaire.update({
      where: { id: gestionnaireId },
      data: {
        ...(zone  !== undefined && { zone:  zone  || null }),
        ...(actif !== undefined && { actif: Boolean(actif) }),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('PATCH /api/admin/agents-terrain/[id]', error);
    return NextResponse.json({ message: 'Erreur modification agent' }, { status: 500 });
  }
}
