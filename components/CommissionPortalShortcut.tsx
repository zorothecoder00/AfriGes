"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { Shield } from "lucide-react";

interface MaData { commissions: { typeCommission: string }[] }

/**
 * Raccourci flottant vers le portail de gouvernance, affiché sur n'importe quel
 * dashboard utilisateur dès lors que la personne siège dans au moins une commission
 * — quel que soit son rôle métier (caissier, comptable, investisseur, collaborateur…).
 * Masqué si aucun siège, ou si l'on est déjà dans le portail gouvernance.
 */
export default function CommissionPortalShortcut() {
  const pathname = usePathname();
  const { data } = useApi<MaData>("/api/membreCommission/ma-commission");
  const count = data?.commissions?.length ?? 0;

  if (count === 0 || pathname?.startsWith("/dashboard/user/gouvernance")) return null;

  return (
    <Link
      href="/dashboard/user/gouvernance"
      title="Accéder à mes commissions de gouvernance"
      className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white text-sm font-medium rounded-2xl shadow-xl hover:bg-emerald-700 transition-colors"
    >
      <Shield className="w-4 h-4" />
      Gouvernance RIA
      {count > 1 && (
        <span className="ml-0.5 bg-white/25 rounded-full px-1.5 text-xs">{count}</span>
      )}
    </Link>
  );
}
