import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TypeCommissionRIA, RoleMembreCommissionRIA } from "@prisma/client";

// Accès total : Admin / SuperAdmin / ResponsableRIA
export async function getCommissionAdminSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const { role, gestionnaireRole } = session.user;
  if (
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    gestionnaireRole === "RESPONSABLE_RIA"
  ) {
    return session;
  }
  return null;
}

// Accès membre : toute personne présente dans MembreCommissionRIA (actif)
export async function getCommissionMembreSession() {
  const session = await getAuthSession();
  if (!session) return null;

  const { role, gestionnaireRole, id } = session.user;

  // Admin/SuperAdmin ont toujours accès
  if (role === "ADMIN" || role === "SUPER_ADMIN" || gestionnaireRole === "RESPONSABLE_RIA") {
    return { session, commission: null, roleMembre: null };
  }

  // Sinon vérifier l'appartenance à une commission active
  const membre = await prisma.membreCommissionRIA.findFirst({
    where: { userId: parseInt(id), actif: true },
    select: { typeCommission: true, role: true },
  });

  if (!membre) return null;
  return { session, commission: membre.typeCommission, roleMembre: membre.role };
}

// Retourne toutes les commissions actives d'un user
export async function getUserCommissions(userId: number) {
  return prisma.membreCommissionRIA.findMany({
    where: { userId, actif: true },
    select: { id: true, typeCommission: true, role: true },
  });
}

// Seul le SUPER_ADMIN peut outrepasser le gating de rôle du workflow inter-commissions
// (soupape d'urgence documentée). ADMIN, RESPONSABLE_RIA et membres doivent réellement
// détenir le siège/rôle requis pour transmettre, approuver, rejeter ou exécuter un dossier.
// La lecture (GET) reste ouverte à la supervision (cf. getRIASession / getCommissionAdminSession).
export function peutOutrepasserGating(role?: string | null): boolean {
  return role === "SUPER_ADMIN";
}

// Rôle actif d'un user dans une commission donnée (null s'il n'en est pas membre actif).
// `db` accepte un client de transaction.
export async function getRoleMembre(
  userId: number,
  typeCommission: TypeCommissionRIA,
  db: Pick<typeof prisma, "membreCommissionRIA"> = prisma
): Promise<RoleMembreCommissionRIA | null> {
  const m = await db.membreCommissionRIA.findUnique({
    where: { typeCommission_userId: { typeCommission, userId } },
    select: { role: true, actif: true },
  });
  return m?.actif ? m.role : null;
}

// Postes habilités (CDC) — réutilisés par les routes réunions/CR.
export const ROLES_PREPARATION_REUNION: RoleMembreCommissionRIA[] = ["PRESIDENT", "RAPPORTEUR_1"];
export const ROLES_REDACTION_CR: RoleMembreCommissionRIA[] = ["PRESIDENT", "RAPPORTEUR_1", "RAPPORTEUR_2"];
// Suivi des tâches/plans d'action (CDC : Rapporteur 2 « Suivi des actions », Président « Attribution des tâches »).
export const ROLES_SUIVI_ACTIONS: RoleMembreCommissionRIA[] = ["PRESIDENT", "RAPPORTEUR_2"];

// Vérifie si un user est PRESIDENT d'une commission donnée
// `db` permet de passer un client de transaction pour rester cohérent avec le reste d'un $transaction
export async function isPresident(
  userId: number,
  typeCommission: TypeCommissionRIA,
  db: Pick<typeof prisma, "membreCommissionRIA"> = prisma
) {
  const m = await db.membreCommissionRIA.findUnique({
    where: { typeCommission_userId: { typeCommission, userId } },
    select: { role: true, actif: true },
  });
  return m?.actif && m.role === "PRESIDENT";
}
