"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useViewAs } from "@/contexts/ViewAsContext";

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Injecte ?viewAs=<userId> dans une URL si le contexte viewAs est actif.
 * Cela permet aux routes API de scoper les données au gestionnaire ciblé.
 */
function injectViewAs(url: string | null, viewAsUserId: number | undefined): string | null {
  if (!url || !viewAsUserId) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}viewAs=${viewAsUserId}`;
}

// Cache mémoire partagé (stale-while-revalidate) + déduplication des requêtes
// en vol, partagés entre tous les composants. Vit le temps de la session de
// l'onglet navigateur ; vidé au rechargement complet de la page.
const apiCache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

// Abonnés montés par URL effective : permet de notifier les hooks `useApi`
// actifs lors d'une invalidation globale, pour qu'ils refetchent immédiatement.
const subscribers = new Map<string, Set<() => void>>();

/**
 * Sélecteur de clés de cache :
 *  - `string`    → match exact OU par préfixe (pratique avec les query params,
 *                   ex. "/api/admin/ria/commissions" cible toutes ses variantes)
 *  - `RegExp`    → test sur la clé complète
 *  - `fn(key)`   → prédicat arbitraire
 *  - `undefined` → tout le cache
 */
export type ApiCacheMatcher = string | RegExp | ((key: string) => boolean);

function keyMatches(key: string, matcher?: ApiCacheMatcher): boolean {
  if (matcher === undefined) return true;
  if (typeof matcher === "string") return key === matcher || key.startsWith(matcher);
  if (matcher instanceof RegExp) return matcher.test(key);
  return matcher(key);
}

/**
 * Invalidation globale du cache client `useApi`.
 *
 * Purge les entrées (et requêtes en vol) correspondant au sélecteur, puis force
 * un refetch de tous les hooks `useApi` montés dont l'URL correspond. Sans
 * argument, vide intégralement le cache (utile au logout / changement d'identité).
 *
 * Exemples :
 *   invalidateApiCache("/api/admin/ria/commissions");   // toutes ses variantes
 *   invalidateApiCache(/\/api\/admin\/ria\//);           // tout le module RIA
 *   invalidateApiCache();                                 // tout
 */
export function invalidateApiCache(matcher?: ApiCacheMatcher): void {
  for (const key of Array.from(apiCache.keys())) {
    if (keyMatches(key, matcher)) apiCache.delete(key);
  }
  // On retire les promesses en vol correspondantes pour garantir un appel réseau
  // frais (postérieur à la mutation) plutôt que de réutiliser une réponse obsolète.
  for (const key of Array.from(inflight.keys())) {
    if (keyMatches(key, matcher)) inflight.delete(key);
  }
  for (const [key, set] of subscribers) {
    if (keyMatches(key, matcher)) {
      for (const cb of set) cb();
    }
  }
}

export function useApi<T>(
  url: string | null,
  options?: RequestInit,
  { refreshInterval }: { refreshInterval?: number } = {}
): UseApiResult<T> {
  const { viewAs } = useViewAs();

  // Injection automatique de ?viewAs= sur tous les GETs
  const effectiveUrl = useMemo(
    () => injectViewAs(url, viewAs?.userId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, viewAs?.userId]
  );

  // Hydratation immédiate depuis le cache : pas de spinner si on a déjà la donnée
  // (ex. retour sur un onglet déjà visité).
  const [data, setData] = useState<T | null>(
    () => (effectiveUrl && apiCache.has(effectiveUrl) ? (apiCache.get(effectiveUrl) as T) : null)
  );
  const [loading, setLoading] = useState(
    () => !(effectiveUrl && apiCache.has(effectiveUrl))
  );
  const [error, setError] = useState<string | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const mountedRef = useRef(true);
  const currentUrlRef = useRef(effectiveUrl);
  currentUrlRef.current = effectiveUrl;

  const fetchData = useCallback(async (force = false) => {
    if (!effectiveUrl) {
      setLoading(false);
      return;
    }

    // Stale-while-revalidate : si on a une valeur en cache, on l'affiche tout de
    // suite (sans spinner) puis on revalide en arrière-plan.
    if (apiCache.has(effectiveUrl) && !force) {
      setData(apiCache.get(effectiveUrl) as T);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      // Déduplication : une seule requête réseau pour une même URL simultanée.
      // (Sur un refetch forcé / une invalidation, `inflight` a déjà été vidé en
      // amont, donc on crée bien une requête fraîche ; les appels forcés
      // concurrents pour la même URL la partagent au lieu de la dupliquer.)
      let promise = inflight.get(effectiveUrl);
      if (!promise) {
        promise = fetch(effectiveUrl, optionsRef.current).then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.message || body.error || `Erreur ${res.status}`);
          }
          return res.json();
        });
        inflight.set(effectiveUrl, promise);
        void promise.catch(() => {}).finally(() => {
          if (inflight.get(effectiveUrl) === promise) inflight.delete(effectiveUrl);
        });
      }

      const json = await promise;
      apiCache.set(effectiveUrl, json);
      // Ignore les réponses obsolètes (URL changée) ou après démontage.
      if (!mountedRef.current || currentUrlRef.current !== effectiveUrl) return;
      setData(json as T);
      setError(null);
    } catch (err: unknown) {
      if (!mountedRef.current || currentUrlRef.current !== effectiveUrl) return;
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      if (mountedRef.current && currentUrlRef.current === effectiveUrl) setLoading(false);
    }
  }, [effectiveUrl]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => { mountedRef.current = false; };
  }, [fetchData]);

  // Abonnement aux invalidations globales : un appel à invalidateApiCache ciblant
  // cette URL déclenche un refetch immédiat de ce hook.
  useEffect(() => {
    if (!effectiveUrl) return;
    const cb = () => { fetchData(true); };
    let set = subscribers.get(effectiveUrl);
    if (!set) { set = new Set(); subscribers.set(effectiveUrl, set); }
    set.add(cb);
    return () => {
      set!.delete(cb);
      if (set!.size === 0) subscribers.delete(effectiveUrl);
    };
  }, [effectiveUrl, fetchData]);

  // Auto-refresh par polling si refreshInterval est fourni
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;
    const id = setInterval(() => fetchData(), refreshInterval);
    return () => clearInterval(id);
  }, [fetchData, refreshInterval]);

  const refetch = useCallback(() => { fetchData(true); }, [fetchData]);

  return { data, loading, error, refetch };
}

interface UseMutationResult<TData, TBody> {
  mutate: (body: TBody) => Promise<TData | null>;
  data: TData | null;
  loading: boolean;
  error: string | null;
}

export function useMutation<TData = unknown, TBody = unknown>(
  url: string | (() => string),
  method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST",
  options?: {
    successMessage?: string;
    errorMessage?: string;
    // Clé(s) de cache à invalider après une mutation réussie : les hooks `useApi`
    // concernés refetchent automatiquement (plus besoin de refetch() manuel).
    invalidate?: ApiCacheMatcher | ApiCacheMatcher[];
  }
): UseMutationResult<TData, TBody> {
  const { viewAs } = useViewAs();
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlRef = useRef(url);
  urlRef.current = url;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mutate = useCallback(
    async (body: TBody): Promise<TData | null> => {
      // Bloquer toute mutation en mode lecture (viewAs actif)
      if (viewAs) {
        const msg = "Action impossible en mode lecture";
        setError(msg);
        toast.error(msg);
        return null;
      }

      const resolvedUrl =
        typeof urlRef.current === "function" ? urlRef.current() : urlRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(resolvedUrl, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.message || errBody.error || `Erreur ${res.status}`);
        }
        const json = await res.json();
        const result = json.data ?? json;
        setData(result);
        if (optionsRef.current?.successMessage) toast.success(optionsRef.current.successMessage);
        // Invalidation du cache client après mutation réussie → refetch auto des GET liés.
        const inv = optionsRef.current?.invalidate;
        if (inv !== undefined) {
          const matchers = Array.isArray(inv) ? inv : [inv];
          for (const m of matchers) invalidateApiCache(m);
        }
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        setError(msg);
        toast.error(optionsRef.current?.errorMessage ?? msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [method, viewAs]
  );

  return { mutate, data, loading, error };
}
