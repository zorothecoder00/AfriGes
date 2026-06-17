import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TypeCommissionRIA } from "@prisma/client";

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
