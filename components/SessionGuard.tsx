"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

/**
 * Composant transparent à placer dans les layouts protégés.
 * Déconnecte automatiquement l'utilisateur si sa session a été révoquée
 * (compte suspendu, déconnexion forcée par un admin).
 */
export default function SessionGuard() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.error === "SESSION_INVALID") {
      signOut({ callbackUrl: "/auth/login?sessionExpired=true" });
    }
  }, [session]);

  return null;
}
