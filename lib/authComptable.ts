import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Vérifie que l'utilisateur est un comptable (ou admin).
 * Retourne la session si OK, null sinon.
 * CDC §43 — CHEF_COMPTABLE a la même surface d'accès que COMPTABLE (saisie +
 * contrôle + validation) ; la distinction entre les deux se joue au niveau de
 * la séparation des fonctions (CDC §44, app/api/comptable/ecritures/[id]/route.ts),
 * pas au niveau de l'accès aux routes.
 */
export async function getComptableSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    gRole === "COMPTABLE" ||
    gRole === "CHEF_COMPTABLE"
  ) {
    return session;
  }
  return null;
}

/**
 * Accès en LECTURE SEULE au module comptable (CDC §43) : en plus des rôles de
 * `getComptableSession`, ouvre les tableaux de bord/états financiers à
 * DIRECTEUR_GENERAL (consultation globale), AUDITEUR_INTERNE (lecture + audit),
 * ACTIONNAIRE (tableaux de bord financiers autorisés) et RESPONSABLE_ACHATS
 * (consultation comptable limitée). Réservé aux endpoints GET qui exposent des
 * états déjà agrégés (dashboard, bilan, résultat, balance, grand livre, notes
 * annexes, flux de trésorerie, contrôles) — jamais aux routes de saisie/
 * modification, qui restent gated par `getComptableSession` seul.
 */
export async function getComptableLectureSession() {
  const session = await getComptableSession();
  if (session) return session;
  const full = await getAuthSession();
  if (!full) return null;
  const gRole = full.user.gestionnaireRole;
  if (
    gRole === "DIRECTEUR_GENERAL" ||
    gRole === "AUDITEUR_INTERNE" ||
    gRole === "ACTIONNAIRE" ||
    gRole === "RESPONSABLE_ACHATS"
  ) {
    return full;
  }
  return null;
}

/**
 * Retourne l'ID du PDV auquel le comptable est affecté (affectation active).
 * Retourne null pour les admins (pas de restriction PDV → vue globale).
 * Si viewAsUserId est fourni (admin en mode lecture), retourne le PDV du user ciblé.
 * Retourne null si le comptable n'a aucune affectation active (fallback global).
 */
/**
 * CDC §68 — un comptable affecté à un PDV (pdvId non null via
 * `getComptablePdvId`) ne doit agir que sur des écritures qui le concernent.
 * `EcritureComptable` n'a pas de `pointDeVenteId` direct (seul `LigneEcriture`
 * l'a, CDC §48 imputation multi-PDV) : au moins une ligne dans le PDV suffit
 * (filtre inclusif, pas exclusif — une écriture multi-PDV reste accessible).
 */
export async function ecritureDansPerimetrePdv(pdvId: number, ecritureId: number): Promise<boolean> {
  const count = await prisma.ligneEcriture.count({ where: { ecritureId, pointDeVenteId: pdvId } });
  return count > 0;
}

export async function getComptablePdvId(
  session: NonNullable<Awaited<ReturnType<typeof getComptableSession>>>,
  viewAsUserId?: number
): Promise<number | null> {
  const role = session.user.role;
  if ((role === "ADMIN" || role === "SUPER_ADMIN") && viewAsUserId !== undefined) {
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: viewAsUserId, actif: true },
      select: { pointDeVenteId: true },
    });
    return aff?.pointDeVenteId ?? null;
  }
  if (role === "ADMIN" || role === "SUPER_ADMIN") return null;

  const affectation = await prisma.gestionnaireAffectation.findFirst({
    where: { userId: Number(session.user.id), actif: true },
    select: { pointDeVenteId: true },
  });
  return affectation?.pointDeVenteId ?? null;
}
