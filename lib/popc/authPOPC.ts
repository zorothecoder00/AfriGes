// lib/popc/authPOPC.ts
// Contrôle d'accès du module POPC (CDC §14). Serveur uniquement.
//
// Mapping des profils du CDC sur les rôles AfriGes existants :
//   Directeur Général    → ADMIN / SUPER_ADMIN            (précisé par le métier)
//   Directeur Commercial → RESPONSABLE_ECONOMIQUE         (rôle le plus proche ; ajustable)
//   Comptabilité         → COMPTABLE
//   Chef d'Agence        → CHEF_AGENCE / RESPONSABLE_COMMUNAUTE (modif limitée à son agence)
//   Superviseur          → CONTROLEUR_TERRAIN             (consultation)
//   Commercial           → AGENT_TERRAIN                  (ses données uniquement)
//   Auditeur             → AUDITEUR_INTERNE               (lecture seule)

import { getAuthSession } from "@/lib/auth";

export interface CapacitesPOPC {
  consulter: boolean;
  modifier: boolean;   // éditer le paramétrage (§3)
  valider: boolean;    // figer les objectifs du mois
  /** Portée : "global" (toutes agences), "agence" (son PDV), "perso" (ses propres données). */
  portee: "global" | "agence" | "perso";
}

const ROLE_ADMIN = ["ADMIN", "SUPER_ADMIN"];

export interface SessionPOPC {
  session: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>;
  userId: number;
  capacites: CapacitesPOPC;
}

/**
 * Retourne la session + les capacités POPC, ou null si l'utilisateur n'a aucun
 * accès au module. L'appelant applique ensuite le scoping (agence/perso).
 */
export async function getPOPCSession(): Promise<SessionPOPC | null> {
  const session = await getAuthSession();
  if (!session) return null;

  const role = session.user.role;
  const gRole = session.user.gestionnaireRole;
  const capacites = capacitesPour(role, gRole);
  if (!capacites) return null;

  return { session, userId: Number(session.user.id), capacites };
}

export function capacitesPour(
  role: string | null | undefined,
  gRole: string | null | undefined,
): CapacitesPOPC | null {
  // Direction Générale (admin) : plein accès global.
  if (role && ROLE_ADMIN.includes(role)) {
    return { consulter: true, modifier: true, valider: true, portee: "global" };
  }

  switch (gRole) {
    // Directeur Commercial & Comptabilité : consultation + modification + validation.
    case "RESPONSABLE_ECONOMIQUE":
    case "COMPTABLE":
      return { consulter: true, modifier: true, valider: true, portee: "global" };

    // Chef d'agence : consultation globale, modification limitée à son agence, pas de validation.
    case "CHEF_AGENCE":
    case "RESPONSABLE_COMMUNAUTE":
      return { consulter: true, modifier: true, valider: false, portee: "agence" };

    // Superviseur : consultation seule.
    case "CONTROLEUR_TERRAIN":
      return { consulter: true, modifier: false, valider: false, portee: "global" };

    // Auditeur : lecture seule.
    case "AUDITEUR_INTERNE":
      return { consulter: true, modifier: false, valider: false, portee: "global" };

    // Commercial : ses propres données uniquement.
    case "AGENT_TERRAIN":
      return { consulter: true, modifier: false, valider: false, portee: "perso" };

    default:
      return null;
  }
}
