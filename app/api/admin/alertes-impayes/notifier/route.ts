import { NextResponse } from 'next/server';
import { PrioriteNotification, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

/**
 * POST /api/admin/alertes-impayes/notifier
 * Envoie une notification de relance à l'agent affecté + admins
 * Body: { souscriptionIds: number[], message?: string }
 */
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const body = await req.json();
    const { souscriptionIds, message } = body as { souscriptionIds: number[]; message?: string };

    if (!Array.isArray(souscriptionIds) || souscriptionIds.length === 0) {
      return NextResponse.json({ message: 'Aucune souscription sélectionnée' }, { status: 400 });
    }

    // Récupérer les souscriptions avec client + agent + pack
    const souscriptions = await prisma.souscriptionPack.findMany({
      where: { id: { in: souscriptionIds }, montantRestant: { gt: 0 } },
      select: {
        id: true,
        montantRestant: true,
        pack: { select: { nom: true } },
        client: {
          select: {
            id: true, nom: true, prenom: true, codeClient: true,
            agentTerrainId: true,
          },
        },
      },
    });

    if (souscriptions.length === 0) {
      return NextResponse.json({ message: 'Souscriptions introuvables' }, { status: 404 });
    }

    // Admins à notifier
    const admins = await prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
      select: { id: true },
    });

    const notifications: {
      userId: number;
      titre: string;
      message: string;
      priorite: PrioriteNotification;
      actionUrl: string;
    }[] = [];

    for (const s of souscriptions) {
      if (!s.client) continue;
      const clientLabel = `${s.client.prenom} ${s.client.nom}${s.client.codeClient ? ` (${s.client.codeClient})` : ''}`;
      const montant     = Number(s.montantRestant).toLocaleString('fr-FR');
      const msg         = message?.trim() || `Relance impayé — ${clientLabel} doit ${montant} FCFA sur le pack ${s.pack.nom}. Merci de contacter le client.`;

      // Notifier l'agent affecté (si présent)
      if (s.client.agentTerrainId) {
        notifications.push({
          userId:    s.client.agentTerrainId,
          titre:     'Relance impayé — action requise',
          message:   msg,
          priorite:  PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/admin/clients/${s.client.id}`,
        });
      }

      // Notifier les admins
      for (const admin of admins) {
        notifications.push({
          userId:    admin.id,
          titre:     'Escalade impayé',
          message:   `${clientLabel} — ${montant} FCFA impayé (${s.pack.nom})`,
          priorite:  PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/admin/alertes-impayes`,
        });
      }
    }

    if (notifications.length > 0) {
      await prisma.notification.createMany({ data: notifications, skipDuplicates: false });
    }

    return NextResponse.json({
      success: true,
      nbNotifications: notifications.length,
      nbClients: souscriptions.length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erreur lors de la notification' }, { status: 500 });
  }
}
