import { useApi } from "@/hooks/useApi";

interface PageAccessResponse {
  allowedPages: string[];
}

/**
 * Hook pour vérifier les accès aux sections du dashboard gestionnaire.
 * Retourne true par défaut pendant le chargement (évite le flash de contenu).
 */
export function usePageAccess() {
  const { data, loading } = useApi<PageAccessResponse>("/api/user/page-access");

  const isAllowed = (key: string): boolean => {
    // Pendant le chargement : tout autorisé pour éviter le flash
    if (loading || !data) return true;
    return data.allowedPages.includes(key);
  };

  return {
    isAllowed,
    loading,
    allowedPages: data?.allowedPages ?? null,
  };
}
