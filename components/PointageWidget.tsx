"use client";

import { Clock } from "lucide-react";
import { usePointage } from "@/hooks/usePointage";
import PointagePanel, { STATUT_CFG } from "@/components/PointagePanel";

/**
 * Bouton flottant de pointage — utilisé sur les portails qui n'ont pas de bloc
 * profil dédié (bloc profil qui, lui, embarque directement le déclencheur, cf.
 * UserPdvBadge) pour éviter le doublon bouton flottant + badge de profil.
 */
export default function PointageWidget() {
  const pointage = usePointage();
  const { open, setOpen, todayLoading, hasProfilRH, pointageToday, peutDepart } = pointage;

  // Pas de ProfilRH → widget invisible
  if (hasProfilRH === false) return null;

  const statutCfg = pointageToday ? (STATUT_CFG[pointageToday.statut] ?? STATUT_CFG.PRESENT) : null;

  return (
    <>
      {/* ── Bouton flottant ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`
          fixed bottom-6 right-6 z-[200] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl
          font-medium text-sm transition-all duration-200
          ${open
            ? "bg-slate-700 text-white"
            : pointageToday
              ? peutDepart
                ? "bg-emerald-600 text-white hover:bg-emerald-700 animate-pulse"
                : "bg-slate-700 text-white hover:bg-slate-800"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          }
        `}
        title="Pointage"
      >
        <Clock className="w-4 h-4" />
        {todayLoading ? (
          <span className="w-10 h-3 bg-white/20 rounded animate-pulse" />
        ) : pointageToday ? (
          peutDepart
            ? <span>Pointer départ</span>
            : <span className={`flex items-center gap-1 ${statutCfg?.color ?? ""}`}>
                {statutCfg?.icon} {statutCfg?.label}
              </span>
        ) : (
          <span>Pointer arrivée</span>
        )}
      </button>

      {/* ── Panneau latéral ── */}
      {open && (
        <PointagePanel
          {...pointage}
          onClose={() => setOpen(false)}
          className="fixed bottom-20 right-6 z-[200] w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        />
      )}
    </>
  );
}
