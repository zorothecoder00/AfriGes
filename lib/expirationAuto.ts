import { StatutCotisation, StatutCreditAlim, PrioriteNotification, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface ExpirationResult {
  cotisationsExpirees: number;
  creditsExpires: number;
}

/**
 * Expire automatiquement :
 * - Les cotisations EN_ATTENTE dont dateExpiration est dépassée → EXPIREE
 * - Les crédits alimentaires ACTIF dont dateExpiration est dépassée → EXPIRE
 *
 * Appelé quotidiennement via /api/cron/expirations
 */
export async function traiterExpirations(): Promise<ExpirationResult> {
  const now = new Date();

  // 1. Cotisations expirées (seulement EN_ATTENTE, pas PAYEE)
  const cotisationsAExpirer = await prisma.cotisation.findMany({
    where: {
      statut: StatutCotisation.EN_ATTENTE,
      dateExpiration: { lt: now },
    },
    include: {
      client: { select: { nom: true, prenom: true } },
    },
  });

  if (cotisationsAExpirer.length > 0) {
    await prisma.cotisation.updateMany({
      where: {
        id: { in: cotisationsAExpirer.map((c) => c.id) },
      },
      data: {
        statut: StatutCotisation.EXPIREE,
      },
    });
  }

  // 2. Crédits alimentaires expirés
  const creditsAExpirer = await prisma.creditAlimentaire.findMany({
    where: {
      statut: StatutCreditAlim.ACTIF,
      dateExpiration: { not: null, lt: now },
    },
    include: {
      client: { select: { nom: true, prenom: true } },
    },
  });

  if (creditsAExpirer.length > 0) {
    await prisma.creditAlimentaire.updateMany({
      where: {
        id: { in: creditsAExpirer.map((c) => c.id) },
      },
      data: {
        statut: StatutCreditAlim.EXPIRE,
      },
    });
  }

  // 3. Notifications aux admins si des expirations ont eu lieu
  const totalExpirations = cotisationsAExpirer.length + creditsAExpirer.length;

  if (totalExpirations > 0) {
    const admins = await prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
      select: { id: true },
    });

    if (admins.length > 0) {
      const lignes: string[] = [];

      if (cotisationsAExpirer.length > 0) {
        lignes.push(`${cotisationsAExpirer.length} cotisation(s) expiree(s)`);
      }
      if (creditsAExpirer.length > 0) {
        lignes.push(`${creditsAExpirer.length} credit(s) alimentaire(s) expire(s)`);
      }

      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          titre: "Expirations automatiques",
          message: `Traitement quotidien : ${lignes.join(", ")}.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: "/dashboard/admin",
        })),
      });
    }
  }

  // 4. Audit log
  if (totalExpirations > 0) {
    await prisma.auditLog.create({
      data: {
        action: "EXPIRATION_AUTOMATIQUE",
        entite: "Systeme",
      },
    });
  }

  return {
    cotisationsExpirees: cotisationsAExpirer.length,
    creditsExpires: creditsAExpirer.length,
  };
}
