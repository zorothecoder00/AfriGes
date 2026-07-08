import { useApi } from "@/hooks/useApi";

type PermissionMap = Record<string, string[]>; // module → actions autorisées

/**
 * Hook RBAC granulaire côté client : masque les boutons/actions selon les
 * permissions effectives de l'utilisateur (cf. lib/permissions.ts, API
 * /api/user/permissions). L'application réelle reste faite côté serveur
 * (requirePermission) ; ceci n'est que du confort d'UI.
 *
 * Renvoie `true` pendant le chargement pour éviter un flash de boutons qui
 * disparaissent (même convention que usePageAccess).
 */
export function usePermissions() {
  const { data, loading } = useApi<{ permissions: PermissionMap }>("/api/user/permissions");

  const can = (moduleKey: string, action: string): boolean => {
    if (loading || !data) return true;
    return (data.permissions[moduleKey] ?? []).includes(action);
  };

  return { can, loading, permissions: data?.permissions ?? null };
}
