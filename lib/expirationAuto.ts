import { StatutVersementPack, StatutSouscription, PrioriteNotification, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface ExpirationResult {
  echeancesEnRetard: number;
  souscriptionsCompletes: number;
  souscriptionsExpireesSignalees: number;
}
  
/**
 * Traite quotidiennement les expirations automatiques liées aux packs :
 *
 * 1. Échéances EN_ATTENTE dont datePrevue est dépassée → EN_RETARD
 * 2. Souscriptions ACTIF dont dateFin est dépassée ET montantRestant <= 0 → COMPLETE
 3. Souscriptions expirées non soldées : ne pas bloquer automatiquement,
 *    mais signaler aux admins pour décision manuelle.
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

  // ─── 3. Souscriptions expirées non soldées : signalement (pas de mutation) ─
  const candidatesExpired = await prisma.souscriptionPack.findMany({
    where: {
      statut: { in: [StatutSouscription.EN_ATTENTE, StatutSouscription.ACTIF, StatutSouscription.SUSPENDU, StatutSouscription.ANNULE] },
      montantRestant: { gt: 0 },
    },
    select: {
      id: true,
      dateDebut: true,
      dateFin: true,
      pack: { select: { dureeJours: true } },
    },
  });

  const idsExpirees = candidatesExpired
    .filter((s) => {
      const deadline = s.dateFin
        ? new Date(s.dateFin)
        : s.pack.dureeJours
        ? new Date(s.dateDebut.getTime() + s.pack.dureeJours * 24 * 60 * 60 * 1000)
        : null;
      return deadline ? deadline < now : false;
    })
    .map((s) => s.id);

  // ─── 4. Notifications admins si des changements ont eu lieu ─────────────────
  const totalModifications =
    echeancesARetarder.length +
    souscriptionsACompleter.length +
    idsExpirees.length;

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
      if (idsExpirees.length > 0)
        lignes.push(`${idsExpirees.length} souscription(s) expirée(s) non soldée(s) à traiter manuellement`);

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

  // ─── 5. Audit log ────────────────────────────────────────────────────────────
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
    souscriptionsExpireesSignalees: idsExpirees.length,
  };
}
