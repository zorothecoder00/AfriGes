import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur est un Responsable Point de Vente (ou admin).
 * Le RPV a des droits étendus sur le stock, les livraisons et la supervision.
 */
export async function getRPVSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role  = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role  === "ADMIN" ||
    role  === "SUPER_ADMIN" ||
    gRole === "RESPONSABLE_POINT_DE_VENTE"
  ) {
    return session;
  }
  return null;
}

/**
 * Vérifie l'accès aux visas "RPV / Chef d'agence / Direction" du CDC (Bon de
 * Sortie §3.4, Demande d'achat interne §5.3) — un gate de workflow ponctuel,
 * volontairement distinct de getRPVSession() qui est aussi le garde d'accès
 * de tout le namespace /api/rpv/** (caisse, ventes, stock…) : y ajouter
 * CHEF_AGENCE ouvrirait ce périmètre opérationnel complet, pas seulement le
 * droit de viser, ce qui dépasse ce que le CDC demande ici.
 */
export async function getVisaRpvOuChefAgenceSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role  = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role  === "ADMIN" ||
    role  === "SUPER_ADMIN" ||
    gRole === "RESPONSABLE_POINT_DE_VENTE" ||
    gRole === "CHEF_AGENCE"
  ) {
    return session;
  }
  return null;
}
