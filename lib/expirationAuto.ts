import { StatutVersementPack, StatutSouscription, PrioriteNotification, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface ExpirationResult {
  echeancesEnRetard: number;
  souscriptionsCompletes: number;
  souscriptionsAnnulees: number;
  souscriptionsSuspendues: number;
}

/**
 * Traite quotidiennement les expirations automatiques liées aux packs :
 *
 * 1. Échéances EN_ATTENTE dont datePrevue est dépassée → EN_RETARD
 * 2. Souscriptions ACTIF dont dateFin est dépassée ET montantRestant <= 0 → COMPLETE
 * 3. Souscriptions EN_ATTENTE dont dateFin est dépassée → ANNULE (jamais activées)
 *
 * Appelé quotidiennement via /api/cron/expirations
 */
export async function traiterExpirations(): Promise<ExpirationResult> {
  const now = new Date();

  // ─── 1. Échéances EN_ATTENTE dont datePrevue est dépassée → EN_RETARD ──────
  const echeancesARetarder = await prisma.echeancePack.findMany({
    where: {
      statut: StatutVersementPack.EN_ATTENTE,
      datePrevue: { lt: now },
    },
    select: { id: true },
  });

  if (echeancesARetarder.length > 0) {
    await prisma.echeancePack.updateMany({
      where: { id: { in: echeancesARetarder.map((e) => e.id) } },
      data: { statut: StatutVersementPack.EN_RETARD },
    });
  }

  // ─── 2. Souscriptions ACTIF expirées + soldées → COMPLETE ──────────────────
  const souscriptionsACompleter = await prisma.souscriptionPack.findMany({
    where: {
      statut: StatutSouscription.ACTIF,
      dateFin: { not: null, lt: now },
      montantRestant: { lte: 0 },
    },
    select: { id: true },
  });

  if (souscriptionsACompleter.length > 0) {
    await prisma.souscriptionPack.updateMany({
      where: { id: { in: souscriptionsACompleter.map((s) => s.id) } },
      data: { statut: StatutSouscription.COMPLETE, dateCloture: now },
    });
  }

  // ─── 3. Souscriptions EN_ATTENTE expirées → ANNULE (jamais activées) ────────
  const souscriptionsAnnulees = await prisma.souscriptionPack.findMany({
    where: {
      statut: StatutSouscription.EN_ATTENTE,
      dateFin: { not: null, lt: now },
    },
    select: { id: true },
  });

  if (souscriptionsAnnulees.length > 0) {
    await prisma.souscriptionPack.updateMany({
      where: { id: { in: souscriptionsAnnulees.map((s) => s.id) } },
      data: { statut: StatutSouscription.ANNULE, dateCloture: now },
    });
  }

  // ─── 4. Souscriptions EN_ATTENTE/ACTIF expirées non soldées → SUSPENDU ───
  // Règle d'expiration :
  // - dateFin explicite si renseignée
  // - sinon dateDebut + pack.dureeJours (si durée définie)
  const candidatesSuspend = await prisma.souscriptionPack.findMany({
    where: {
      statut: { in: [StatutSouscription.EN_ATTENTE, StatutSouscription.ACTIF] },
      montantRestant: { gt: 0 },
    },
    select: {
      id: true,
      dateDebut: true,
      dateFin: true,
      pack: { select: { dureeJours: true } },
    },
  });

  const idsSuspendues = candidatesSuspend
    .filter((s) => {
      const deadline = s.dateFin
        ? new Date(s.dateFin)
        : s.pack.dureeJours
        ? new Date(s.dateDebut.getTime() + s.pack.dureeJours * 24 * 60 * 60 * 1000)
        : null;
      return deadline ? deadline < now : false;
    })
    .map((s) => s.id);

  if (idsSuspendues.length > 0) {
    await prisma.souscriptionPack.updateMany({
      where: { id: { in: idsSuspendues } },
      data: { statut: StatutSouscription.SUSPENDU },
    });
  }

  // ─── 5. Notifications admins si des changements ont eu lieu ─────────────────
  const totalModifications =
    echeancesARetarder.length +
    souscriptionsACompleter.length +
    souscriptionsAnnulees.length +
    idsSuspendues.length;

  if (totalModifications > 0) {
    const admins = await prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
      select: { id: true },
    });

    if (admins.length > 0) {
      const lignes: string[] = [];
      if (echeancesARetarder.length > 0)
        lignes.push(`${echeancesARetarder.length} échéance(s) passée(s) EN_RETARD`);
      if (souscriptionsACompleter.length > 0)
        lignes.push(`${souscriptionsACompleter.length} souscription(s) complétée(s) automatiquement`);
      if (souscriptionsAnnulees.length > 0)
        lignes.push(`${souscriptionsAnnulees.length} souscription(s) annulée(s) (jamais activées)`);
      if (idsSuspendues.length > 0)
        lignes.push(`${idsSuspendues.length} souscription(s) suspendue(s) (échéance dépassée)`);

      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          titre: "Expirations packs — traitement automatique",
          message: `Traitement quotidien : ${lignes.join(", ")}.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: "/dashboard/admin/packs",
        })),
      });
    }
  }  

  // ─── 6. Audit log ────────────────────────────────────────────────────────────
  if (totalModifications > 0) {
    await prisma.auditLog.create({
      data: {
        action: "EXPIRATION_AUTOMATIQUE_PACKS",
        entite: "Pack",
      },
    });
  }

  return {
    echeancesEnRetard: echeancesARetarder.length,
    souscriptionsCompletes: souscriptionsACompleter.length,
    souscriptionsAnnulees: souscriptionsAnnulees.length,
    souscriptionsSuspendues: idsSuspendues.length,
  };
}
