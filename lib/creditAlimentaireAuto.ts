import { Prisma, PrismaClient, SourceCreditAlim, StatutCreditAlim, PrioriteNotification, Role } from "@prisma/client";

const DUREE_EXPIRATION_JOURS = 30;

// Type du client transactionnel Prisma (le `tx` dans prisma.$transaction(async (tx) => ...))
type PrismaTx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export type { PrismaTx };

interface CotisationPayee {
  id: number;
  clientId: number | null;
  montant: Prisma.Decimal;
}

interface TontinePotRecu {
  cycleId: number;
  clientId: number | null;
  memberId?: number | null;
  montantPot: Prisma.Decimal;
}

/**
 * Génère automatiquement un crédit alimentaire lorsqu'une cotisation passe à PAYEE.
 * - Plafond = montant de la cotisation
 * - Expiration = 30 jours après création
 * - Vérifie qu'un crédit actif n'existe pas déjà pour cette source
 *
 * @returns Le crédit créé, ou null si non applicable
 */
export async function genererCreditAlimentaireDepuisCotisation(
  tx: PrismaTx,
  cotisation: CotisationPayee
) {
  // On ne génère que pour les cotisations liées à un client
  if (!cotisation.clientId) return null;

  // Vérifier qu'il n'existe pas déjà un crédit actif pour cette cotisation
  const creditExistant = await tx.creditAlimentaire.findFirst({
    where: {
      clientId: cotisation.clientId,
      source: SourceCreditAlim.COTISATION,
      sourceId: cotisation.id,
      statut: StatutCreditAlim.ACTIF,
    },
  });

  if (creditExistant) return null;

  const dateExpiration = new Date();
  dateExpiration.setDate(dateExpiration.getDate() + DUREE_EXPIRATION_JOURS);

  const credit = await tx.creditAlimentaire.create({
    data: {
      clientId: cotisation.clientId,
      plafond: cotisation.montant,
      montantUtilise: 0,
      montantRestant: cotisation.montant,
      source: SourceCreditAlim.COTISATION,
      sourceId: cotisation.id,
      dateExpiration,
      statut: StatutCreditAlim.ACTIF,
    },
  });

  // Notifier les admins
  const admins = await tx.user.findMany({
    where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
    select: { id: true },
  });

  const client = await tx.client.findUnique({
    where: { id: cotisation.clientId },
    select: { nom: true, prenom: true },
  });

  const clientNom = client ? `${client.prenom} ${client.nom}` : "Client";

  if (admins.length > 0) {
    await tx.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        titre: "Credit alimentaire auto-genere",
        message: `Un credit alimentaire de ${cotisation.montant} FCFA a ete genere pour ${clientNom} suite au paiement de la cotisation #${cotisation.id}.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/creditsAlimentaires/${credit.id}`,
      })),
    });
  }

  return credit;
}

/**
 * Génère automatiquement un crédit alimentaire lorsqu'un cycle de tontine est complété.
 * Le bénéficiaire du cycle reçoit un crédit dont le plafond = montant du pot.
 * - Expiration = 30 jours après création
 * - Vérifie qu'un crédit actif n'existe pas déjà pour ce cycle
 *
 * @returns Le crédit créé, ou null si non applicable
 */
export async function genererCreditAlimentaireDepuisTontine(
  tx: PrismaTx,
  pot: TontinePotRecu
) {
  // Le bénéficiaire doit être identifié par clientId OU memberId
  if (!pot.clientId && !pot.memberId) return null;

  // Vérifier qu'il n'existe pas déjà un crédit actif pour ce cycle
  const creditExistant = await tx.creditAlimentaire.findFirst({
    where: {
      ...(pot.clientId ? { clientId: pot.clientId } : { memberId: pot.memberId! }),
      source: SourceCreditAlim.TONTINE,
      sourceId: pot.cycleId,
      statut: StatutCreditAlim.ACTIF,
    },
  });

  if (creditExistant) return null;

  const dateExpiration = new Date();
  dateExpiration.setDate(dateExpiration.getDate() + DUREE_EXPIRATION_JOURS);

  const credit = await tx.creditAlimentaire.create({
    data: {
      ...(pot.clientId ? { clientId: pot.clientId } : { memberId: pot.memberId! }),
      plafond: pot.montantPot,
      montantUtilise: 0,
      montantRestant: pot.montantPot,
      source: SourceCreditAlim.TONTINE,
      sourceId: pot.cycleId,
      dateExpiration,
      statut: StatutCreditAlim.ACTIF,
    },
  });

  const admins = await tx.user.findMany({
    where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
    select: { id: true },
  });

  // Récupérer le nom du bénéficiaire (client ou membre)
  let benefNom = "Bénéficiaire";
  if (pot.clientId) {
    const client = await tx.client.findUnique({
      where: { id: pot.clientId },
      select: { nom: true, prenom: true },
    });
    if (client) benefNom = `${client.prenom} ${client.nom}`;
  } else if (pot.memberId) {
    const member = await tx.user.findUnique({
      where: { id: pot.memberId! },
      select: { nom: true, prenom: true },
    });
    if (member) benefNom = `${member.prenom ?? ""} ${member.nom ?? ""}`.trim();
  }

  if (admins.length > 0) {
    await tx.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        titre: "Credit alimentaire auto-genere (Tontine)",
        message: `Un credit alimentaire de ${pot.montantPot} FCFA a ete genere pour ${benefNom} suite a la reception du pot tontine (cycle #${pot.cycleId}).`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/creditsAlimentaires/${credit.id}`,
      })),
    });
  }

  return credit;
}
