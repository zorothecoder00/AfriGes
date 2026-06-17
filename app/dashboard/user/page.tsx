"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const ROLE_ROUTES: Record<string, string> = {
  RESPONSABLE_POINT_DE_VENTE:          "/dashboard/user/responsablesPointDeVente",
  CHEF_AGENCE:                          "/dashboard/user/chefAgence",
  CAISSIER:                             "/dashboard/user/caissiers",
  COMPTABLE:                            "/dashboard/user/comptables",
  MAGAZINIER:                           "/dashboard/user/magasiniers",
  AGENT_LOGISTIQUE_APPROVISIONNEMENT:   "/dashboard/user/logistiquesApprovisionnements",
  AGENT_TERRAIN:                        "/dashboard/user/agentsTerrain",
  RESPONSABLE_VENTE_CREDIT:             "/dashboard/user/responsablesVenteCredit",
  RESPONSABLE_RH:                       "/dashboard/user/responsablesRH",
  RESPONSABLE_RIA:                      "/dashboard/user/responsablesRIA",
  INVESTISSEUR_RIA:                     "/dashboard/user/investisseurs",
  PRESIDENT_COMMISSION_RIA:             "/dashboard/user/gouvernance",
  RAPPORTEUR_COMMISSION_RIA:            "/dashboard/user/gouvernance",
  COMMERCIAL:                           "/dashboard/user/revendeurs",
};

export default function UserDashboardRouter() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) { router.replace("/auth/login"); return; }

    const gRole = session.user.gestionnaireRole as string | null;
    const dest  = gRole ? ROLE_ROUTES[gRole] : null;

    if (dest) {
      router.replace(dest);
      return;
    }
    if (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN") {
      router.replace("/dashboard/admin");
      return;
    }

    // Pas de rôle gestionnaire dédié : un user peut tout de même siéger dans une
    // commission de gouvernance. On vérifie son/ses siège(s) avant de retomber
    // sur le portail actionnaire par défaut.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/membreCommission/ma-commission");
        const hasSeat = res.ok && (await res.json())?.commissions?.length > 0;
        if (!cancelled) router.replace(hasSeat ? "/dashboard/user/gouvernance" : "/dashboard/user/actionnaires");
      } catch {
        if (!cancelled) router.replace("/dashboard/user/actionnaires");
      }
    })();
    return () => { cancelled = true; };
  }, [session, status, router]);

  return (
    <div className="flex items-center justify-center min-h-screen text-slate-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
      Redirection…
    </div>
  );
}
