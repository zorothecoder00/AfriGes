"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AppLoader from "@/components/AppLoader";

/**
 * Aiguillage racine du tableau de bord.
 *
 * Cible du `callbackUrl` après une connexion (notamment Google, qui ne passe
 * pas par le routage manuel de la page de login). On redirige selon le rôle :
 *   ADMIN / SUPER_ADMIN → /dashboard/admin
 *   USER                → /dashboard/user (qui affine ensuite selon gestionnaireRole)
 */
export default function DashboardRouter() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) { router.replace("/auth/login"); return; }

    if (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN") {
      router.replace("/dashboard/admin");
    } else {
      router.replace("/dashboard/user");
    }
  }, [session, status, router]);

  return <AppLoader message="Ouverture de votre espace…" />;
}
