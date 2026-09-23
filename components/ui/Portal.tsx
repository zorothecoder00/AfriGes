"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const noopSubscribe = () => () => {};

/**
 * Rend ses enfants directement dans <body>. Indispensable pour les modales
 * posées dans une page qui crée son propre contexte d'empilement (ex. wrapper
 * `relative isolate` pour le décor en fond) : sans portail, même un z-[130]
 * reste confiné à ce contexte et passe sous la barre du haut (sticky z-50).
 */
export default function Portal({ children }: { children: ReactNode }) {
  // false pendant le rendu serveur / l'hydratation, true une fois côté client.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return mounted ? createPortal(children, document.body) : null;
}
