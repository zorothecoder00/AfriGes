"use client";

import {
  LogIn, LogOut, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Sun, Plane, X, CalendarDays, ChevronRight, Wallet, GraduationCap, CalendarClock,
  Printer, Star, Clock,
} from "lucide-react";
import Link from "next/link";
import type { UsePointageReturn } from "@/hooks/usePointage";

// ── Helpers (partagés avec le badge fusionné pour l'icône de statut) ────────────

export const STATUT_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PRESENT:      { label: "Présent",    color: "text-emerald-600", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  ABSENT:       { label: "Absent",     color: "text-red-500",     icon: <XCircle     className="w-3.5 h-3.5" /> },
  RETARD:       { label: "En retard",  color: "text-amber-500",   icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  DEMI_JOURNEE: { label: "½ journée",  color: "text-orange-500",  icon: <Sun         className="w-3.5 h-3.5" /> },
  CONGE:        { label: "Congé",      color: "text-blue-500",    icon: <Sun         className="w-3.5 h-3.5" /> },
  MISSION:      { label: "Mission",    color: "text-purple-500",  icon: <Plane       className="w-3.5 h-3.5" /> },
  FERIE:        { label: "Férié",      color: "text-slate-400",   icon: <Sun         className="w-3.5 h-3.5" /> },
};

function formatTime(iso: string | null): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatMinutes(min: number | null): string {
  if (min === null || min <= 0) return "--";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
}

function formatDateCourt(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

// ── Composant ──────────────────────────────────────────────────────────────────

/**
 * Panneau de pointage self-service — contenu partagé entre le bouton flottant
 * (PointageWidget, portails sans bloc profil dédié) et le badge fusionné du
 * profil (UserPdvBadge, portails avec leur propre topbar). `className` pilote
 * le positionnement (fixed en bas à droite pour le flottant, absolute sous le
 * badge pour le mode fusionné).
 */
export default function PointagePanel(props: UsePointageReturn & { onClose: () => void; className?: string }) {
  const {
    showHistory, setShowHistory, loading, histData,
    pointer, pointageToday, config, peutArrivee, peutDepart, saisiRH, valide,
    onClose, className,
  } = props;

  const statutCfg = pointageToday ? (STATUT_CFG[pointageToday.statut] ?? STATUT_CFG.PRESENT) : null;

  const now = new Date();
  const heure = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const jour  = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className={className ?? "w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"}>

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">{heure}</p>
          <p className="text-indigo-200 text-xs capitalize">{jour}</p>
        </div>
        <button onClick={onClose} className="text-indigo-200 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">

        {/* Statut du jour */}
        {pointageToday ? (
          <div className={`rounded-xl border p-3 space-y-2 ${saisiRH ? "bg-slate-50 border-slate-200" : "bg-emerald-50 border-emerald-200"}`}>
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-1.5 text-sm font-semibold ${statutCfg?.color}`}>
                {statutCfg?.icon} {statutCfg?.label}
              </span>
              {valide && (
                <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Validé
                </span>
              )}
              {saisiRH && (
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">par RH</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <LogIn  className="w-3.5 h-3.5 text-emerald-500" />
                Arrivée : <span className="font-semibold">{formatTime(pointageToday.heureArrivee)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                Départ : <span className="font-semibold">{formatTime(pointageToday.heureDepart)}</span>
              </div>
            </div>

            {(pointageToday.tempsTotal || pointageToday.retardMinutes) && (
              <div className="flex gap-3 text-xs">
                {pointageToday.tempsTotal !== null && (
                  <span className="text-slate-600">
                    Temps : <span className="font-semibold text-slate-800">{formatMinutes(pointageToday.tempsTotal)}</span>
                  </span>
                )}
                {pointageToday.retardMinutes !== null && pointageToday.retardMinutes > 0 && (
                  <span className="text-amber-600">
                    Retard : <span className="font-semibold">{formatMinutes(pointageToday.retardMinutes)}</span>
                  </span>
                )}
                {pointageToday.heuresSup !== null && pointageToday.heuresSup > 0 && (
                  <span className="text-indigo-600">
                    HS : <span className="font-semibold">{formatMinutes(pointageToday.heuresSup)}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center">
            <p className="text-sm text-slate-500">Pas encore de pointage aujourd&apos;hui</p>
            {config?.heureArrivee && (
              <p className="text-xs text-slate-400 mt-0.5">
                Horaire théorique : {config.heureArrivee} → {config.heureDepart ?? "--:--"}
              </p>
            )}
          </div>
        )}

        {/* Boutons d'action */}
        {peutArrivee && (
          <button
            onClick={() => pointer("ARRIVEE")}
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm shadow-emerald-200"
          >
            {loading ? (
              <Clock className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            Pointer mon arrivée
          </button>
        )}

        {peutDepart && (
          <button
            onClick={() => pointer("DEPART")}
            disabled={loading}
            className="w-full py-3 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            {loading ? (
              <Clock className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            Pointer mon départ
          </button>
        )}

        {saisiRH && !pointageToday?.heureDepart && (
          <p className="text-xs text-center text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
            Pointage saisi par le RH — pas d&apos;action requise de votre part.
          </p>
        )}

        {/* Accès Congés & Absences */}
        <Link
          href="/dashboard/user/collaborateur/conges"
          onClick={onClose}
          className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="w-4 h-4" /> Congés &amp; absences
          </span>
          <ChevronRight className="w-4 h-4" />
        </Link>

        {/* Accès Avances & Prêts */}
        <Link
          href="/dashboard/user/collaborateur/avances-prets"
          onClick={onClose}
          className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Wallet className="w-4 h-4" /> Avances &amp; prêts
          </span>
          <ChevronRight className="w-4 h-4" />
        </Link>

        {/* Accès Formations */}
        <Link
          href="/dashboard/user/collaborateur/formations"
          onClick={onClose}
          className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 hover:bg-blue-100 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <GraduationCap className="w-4 h-4" /> Formations
          </span>
          <ChevronRight className="w-4 h-4" />
        </Link>

        {/* Accès Planning d'équipe */}
        <Link
          href="/dashboard/user/collaborateur/planning"
          onClick={onClose}
          className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-violet-50 border border-violet-100 text-violet-700 hover:bg-violet-100 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="w-4 h-4" /> Mon planning
          </span>
          <ChevronRight className="w-4 h-4" />
        </Link>

        {/* Accès Mes évaluations */}
        <Link
          href="/dashboard/user/collaborateur/evaluations"
          onClick={onClose}
          className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 hover:bg-amber-100 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Star className="w-4 h-4" /> Mes évaluations
          </span>
          <ChevronRight className="w-4 h-4" />
        </Link>

        {/* Ma feuille de pointage (PDF, mois en cours) */}
        <a
          href={`/api/collaborateur/pointage/feuille?mois=${now.getMonth() + 1}&annee=${now.getFullYear()}`}
          target="_blank" rel="noreferrer"
          className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Printer className="w-4 h-4" /> Ma feuille de pointage
          </span>
          <ChevronRight className="w-4 h-4" />
        </a>

        {/* Historique dépliable */}
        <div>
          <button
            onClick={() => setShowHistory(h => !h)}
            className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors py-1"
          >
            <span>Historique (7 derniers jours)</span>
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showHistory && (
            <div className="mt-2 space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {(histData?.data ?? []).length === 0 && (
                <p className="text-xs text-center text-slate-400 py-3">Aucun pointage enregistré</p>
              )}
              {(histData?.data ?? []).map(p => {
                const sc = STATUT_CFG[p.statut] ?? STATUT_CFG.PRESENT;
                return (
                  <div key={p.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <span className="text-slate-600 capitalize">{formatDateCourt(p.date)}</span>
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 font-medium ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                      {p.tempsTotal !== null && (
                        <span className="text-slate-400">{formatMinutes(p.tempsTotal)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
