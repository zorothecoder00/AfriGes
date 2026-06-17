"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { Shield, Wallet } from "lucide-react";

interface MaCommissionData { commissions: { typeCommission: string }[] }
interface AccesInvestisseurData { estInvestisseur: boolean }

/**
 * Raccourcis flottants vers les portails RIA (gouvernance & investisseur),
 * affichés sur n'importe quel dashboard utilisateur dès lors que la personne
 * y a accès — quel que soit son rôle métier. Chaque raccourci n'apparaît que
 * si l'accès est réel (siège de commission / profil investisseur) et est masqué
 * lorsqu'on est déjà dans le portail correspondant. Les deux s'empilent.
 */
export default function RiaAccessShortcuts() {
  const pathname = usePathname();
  const { data: comm } = useApi<MaCommissionData>("/api/membreCommission/ma-commission");
  const { data: inv } = useApi<AccesInvestisseurData>("/api/investisseurRIA/mon-acces");

  const nbComm = comm?.commissions?.length ?? 0;
  const showComm = nbComm > 0 && !pathname?.startsWith("/dashboard/user/gouvernance");
  const showInv = !!inv?.estInvestisseur && !pathname?.startsWith("/dashboard/user/investisseurs");

  if (!showComm && !showInv) return null;

  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col-reverse gap-2">
      {showComm && (
        <Link
          href="/dashboard/user/gouvernance"
          title="Accéder à mes commissions de gouvernance"
          className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white text-sm font-medium rounded-2xl shadow-xl hover:bg-emerald-700 transition-colors"
        >
          <Shield className="w-4 h-4" />
          Gouvernance RIA
          {nbComm > 1 && <span className="ml-0.5 bg-white/25 rounded-full px-1.5 text-xs">{nbComm}</span>}
        </Link>
      )}
      {showInv && (
        <Link
          href="/dashboard/user/investisseurs"
          title="Accéder à mon portail investisseur"
          className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white text-sm font-medium rounded-2xl shadow-xl hover:bg-indigo-700 transition-colors"
        >
          <Wallet className="w-4 h-4" />
          Mon portail investisseur
        </Link>
      )}
    </div>
  );
}
