"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Clock, LogIn, LogOut, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Sun, Plane, X, CalendarDays, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PointageToday {
  id:            number;
  date:          string;
  heureArrivee:  string | null;
  heureDepart:   string | null;
  statut:        string;
  source:        string;
  tempsTotal:    number | null;
  retardMinutes: number | null;
  heuresSup:     number | null;
  valideParId:   number | null;
}

interface TodayResponse {
  profilRH:     { id: number; matricule: string } | null;
  pointage:     PointageToday | null;
  configHoraire: { heureArrivee: string | null; heureDepart: string | null } | null;
}

interface HistoriqueItem {
  id:           number;
  date:         string;
  statut:       string;
  tempsTotal:   number | null;
  heureArrivee: string | null;
  heureDepart:  string | null;
  source:       string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUT_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
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

export default function PointageWidget() {
  const [open,        setOpen]        = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [refreshKey,  setRefreshKey]  = useState(0);

  const { data: todayData, loading: todayLoading } =
    useApi<TodayResponse>(`/api/collaborateur/pointage/today?_=${refreshKey}`);

  const { data: histData } =
    useApi<{ data: HistoriqueItem[] }>(
      showHistory ? `/api/collaborateur/pointage?limit=7&_=${refreshKey}` : null,
    );

  // Ferme le panneau avec Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const pointer = useCallback(async (action: "ARRIVEE" | "DEPART") => {
    setLoading(true);
    try {
      const res = await fetch("/api/collaborateur/pointage", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Erreur lors du pointage");
      } else {
        toast.success(action === "ARRIVEE" ? "Arrivée pointée ✓" : "Départ pointé ✓");
        setRefreshKey(k => k + 1);
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, []);

  // Pas de ProfilRH → widget invisible
  if (!todayLoading && todayData?.profilRH === null) return null;

  const pointage     = todayData?.pointage ?? null;
  const config       = todayData?.configHoraire ?? null;
  const statutCfg    = pointage ? (STATUT_CFG[pointage.statut] ?? STATUT_CFG.PRESENT) : null;

  const peutArrivee  = !pointage;
  const peutDepart   = !!pointage && !pointage.heureDepart && pointage.source === "SELF_SERVICE";
  const saisiRH      = !!pointage && pointage.source !== "SELF_SERVICE";
  const valide       = !!pointage?.valideParId;

  const now = new Date();
  const heure = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const jour  = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

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
            : pointage
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
        ) : pointage ? (
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
        <div className="fixed bottom-20 right-6 z-[200] w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-white font-semibold text-sm">{heure}</p>
              <p className="text-indigo-200 text-xs capitalize">{jour}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-indigo-200 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">

            {/* Statut du jour */}
            {pointage ? (
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
                    Arrivée : <span className="font-semibold">{formatTime(pointage.heureArrivee)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <LogOut className="w-3.5 h-3.5 text-slate-400" />
                    Départ : <span className="font-semibold">{formatTime(pointage.heureDepart)}</span>
                  </div>
                </div>

                {(pointage.tempsTotal || pointage.retardMinutes) && (
                  <div className="flex gap-3 text-xs">
                    {pointage.tempsTotal !== null && (
                      <span className="text-slate-600">
                        Temps : <span className="font-semibold text-slate-800">{formatMinutes(pointage.tempsTotal)}</span>
                      </span>
                    )}
                    {pointage.retardMinutes !== null && pointage.retardMinutes > 0 && (
                      <span className="text-amber-600">
                        Retard : <span className="font-semibold">{formatMinutes(pointage.retardMinutes)}</span>
                      </span>
                    )}
                    {pointage.heuresSup !== null && pointage.heuresSup > 0 && (
                      <span className="text-indigo-600">
                        HS : <span className="font-semibold">{formatMinutes(pointage.heuresSup)}</span>
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

            {saisiRH && !pointage?.heureDepart && (
              <p className="text-xs text-center text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                Pointage saisi par le RH — pas d&apos;action requise de votre part.
              </p>
            )}

            {/* Accès Congés & Absences */}
            <Link
              href="/dashboard/user/collaborateur/conges"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="w-4 h-4" /> Congés &amp; absences
              </span>
              <ChevronRight className="w-4 h-4" />
            </Link>

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
      )}
    </>
  );
}
