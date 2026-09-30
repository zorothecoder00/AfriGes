"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { Network, Shield, Wallet, X } from "lucide-react";

interface MaCommissionData { commissions: { typeCommission: string }[] }
interface AccesInvestisseurData { estInvestisseur: boolean }

/**
 * Raccourcis vers les portails RIA (gouvernance & investisseur), affichés sur
 * n'importe quel dashboard utilisateur dès lors que la personne y a accès —
 * quel que soit son rôle métier. Chaque raccourci n'apparaît que si l'accès est
 * réel (siège de commission / profil investisseur) et est masqué lorsqu'on est
 * déjà dans le portail correspondant.
 *
 * Replié en un bouton rond en bas à droite : déplié en permanence en bas à
 * gauche, il recouvrait le bas des menus latéraux (ex. « Factures » / « Clôture »
 * du caissier). `aboveWidget` le remonte au-dessus du bouton flottant de
 * pointage quand celui-ci est affiché au même coin.
 */
export default function RiaAccessShortcuts({ aboveWidget = false }: { aboveWidget?: boolean }) {
  const pathname = usePathname();
  const { data: comm } = useApi<MaCommissionData>("/api/membreCommission/ma-commission");
  const { data: inv } = useApi<AccesInvestisseurData>("/api/investisseurRIA/mon-acces");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const nbComm = comm?.commissions?.length ?? 0;
  const showComm = nbComm > 0 && !pathname?.startsWith("/dashboard/user/gouvernance");
  const showInv = !!inv?.estInvestisseur && !pathname?.startsWith("/dashboard/user/investisseurs");

  if (!showComm && !showInv) return null;

  return (
    <div ref={ref} className={`fixed right-6 z-40 flex flex-col items-end gap-2 ${aboveWidget ? "bottom-24" : "bottom-6"}`}>
      {open && (
        <div className="flex flex-col items-end gap-2">
          {showComm && (
            <Link
              href="/dashboard/user/gouvernance"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-2xl shadow-xl hover:bg-emerald-700 transition-colors"
            >
              <Shield className="w-4 h-4" />
              Gouvernance RIA
              {nbComm > 1 && <span className="ml-0.5 bg-white/25 rounded-full px-1.5 text-xs">{nbComm}</span>}
            </Link>
          )}
          {showInv && (
            <Link
              href="/dashboard/user/investisseurs"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-2xl shadow-xl hover:bg-indigo-700 transition-colors"
            >
              <Wallet className="w-4 h-4" />
              Mon portail investisseur
            </Link>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Fermer les raccourcis RIA" : "Ouvrir les raccourcis RIA"}
        title="Portails RIA"
        className="relative w-12 h-12 grid place-items-center rounded-full bg-indigo-600 text-white shadow-xl hover:bg-indigo-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      >
        {open ? <X className="w-5 h-5" /> : <Network className="w-5 h-5" />}
        {!open && showComm && showInv && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-emerald-500 text-[11px] font-bold grid place-items-center">2</span>
        )}
      </button>
    </div>
  );
}
