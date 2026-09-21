"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Lit `?detail=<id>` (liens du Centre de commandement) et fait défiler jusqu'à l'élément
 * `#doc-<id>` une fois la liste chargée. Retourne l'id ciblé (à surligner) ou null.
 * Le composant appelant doit être rendu sous un <Suspense> (useSearchParams).
 */
export function useFocusDetail(pret: boolean): number | null {
  const raw = useSearchParams().get("detail");
  const id = raw && Number.isInteger(Number(raw)) ? Number(raw) : null;

  useEffect(() => {
    if (id == null || !pret) return;
    document.getElementById(`doc-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [id, pret]);

  return id;
}
