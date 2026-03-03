"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner"; 

interface UseApiResult<T> {      
  data: T | null;
  loading: boolean;   
  error: string | null;       
  refetch: () => void;
}

export function useApi<T>(url: string | null, options?: RequestInit): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const fetchData = useCallback(async () => {
    if (!url) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, optionsRef.current);
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
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stocke toujours la valeur la plus récente sans déclencher de re-render
  const urlRef = useRef(url);
  urlRef.current = url;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mutate = useCallback(
    async (body: TBody): Promise<TData | null> => {
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
    [method] // url et options lus via refs — plus besoin dans les deps
  );

  return { mutate, data, loading, error };
}
