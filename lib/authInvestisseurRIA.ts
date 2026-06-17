import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Accès au portail investisseur : Admin / SuperAdmin / role INVESTISSEUR_RIA,
// OU tout gestionnaire possédant un profil investisseur (profilRIA) — y compris
// s'il exerce par ailleurs un autre métier (caissier, comptable…). Le marqueur
// fiable d'un investisseur est le profilRIA, pas le rôle gestionnaire.
export async function getInvestisseurRIASession() {
  const session = await getAuthSession();
  if (!session) return null;

  const role  = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (role === "ADMIN" || role === "SUPER_ADMIN" || gRole === "INVESTISSEUR_RIA") {
    return session;
  }

  // Gestionnaire-investisseur : rôle métier différent mais profilRIA présent
  const gestionnaire = await prisma.gestionnaire.findFirst({
    where: { memberId: parseInt(session.user.id), profilRIA: { isNot: null } },
    select: { id: true },
  });
  if (gestionnaire) return session;

  return null;
}
