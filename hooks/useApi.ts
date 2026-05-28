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

export function useApi<T>(
  url: string | null,
  options?: RequestInit,
  { refreshInterval }: { refreshInterval?: number } = {}
): UseApiResult<T> {
  const { viewAs } = useViewAs();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Injection automatique de ?viewAs= sur tous les GETs
  const effectiveUrl = useMemo(
    () => injectViewAs(url, viewAs?.userId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, viewAs?.userId]
  );

  const fetchData = useCallback(async () => {
    if (!effectiveUrl) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(effectiveUrl, optionsRef.current);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || `Erreur ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [effectiveUrl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh par polling si refreshInterval est fourni
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;
    const id = setInterval(fetchData, refreshInterval);
    return () => clearInterval(id);
  }, [fetchData, refreshInterval]);

  return { data, loading, error, refetch: fetchData };
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
  options?: { successMessage?: string; errorMessage?: string }
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
