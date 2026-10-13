import { getAuthSession } from "@/lib/auth";
import { resolveUserPdvs } from "@/lib/userPdv";

/**
 * Vérifie que l'utilisateur connecté est un Responsable Vente Crédit (RVC),
 * un Admin ou un Super Admin.
 * Retourne la session si OK, null sinon.
 */
export async function getRVCSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role  = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role  === "ADMIN"                   ||
    role  === "SUPER_ADMIN"             ||
    gRole === "RESPONSABLE_VENTE_CREDIT"
  ) {
    return session;
  }
  return null;
}

/**
 * Correction des crédits clients (modifier / supprimer un crédit ou un de ses
 * remboursements) : Admin, RVC — et le Responsable Point de Vente, limité aux
 * crédits de son propre point de vente (erreurs de saisie à l'agence).
 *
 * `pdvIds` = null → accès réseau complet (Admin / RVC, comportement historique
 * des routes /api/admin/credits/**) ; sinon liste des PDV autorisés (RPV).
 */
export async function getCorrectionCreditSession() {
  const session = await getRVCSession();
  if (session) return { session, pdvIds: null as number[] | null, estRPV: false };

  const rpv = await getAuthSession();
  if (!rpv || rpv.user.gestionnaireRole !== "RESPONSABLE_POINT_DE_VENTE") return null;
  const pdvIds = (await resolveUserPdvs(parseInt(rpv.user.id))).map((p) => p.id);
  return { session: rpv, pdvIds, estRPV: true };
}

/** Le crédit (par son pointDeVenteId) est-il dans le périmètre de la session de correction ? */
export function creditDansPerimetre(pdvIds: number[] | null, creditPdvId: number | null): boolean {
  if (pdvIds === null) return true;
  return creditPdvId != null && pdvIds.includes(creditPdvId);
}
