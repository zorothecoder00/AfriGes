"use client";

import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import {
  TrendingUp, RefreshCw, BarChart3, Target, CheckCircle2, Clock,
  Users, Calendar, Gavel, ListChecks, AlertTriangle, FileText,
} from "lucide-react";

interface KpiCommission {
  type: string;
  label: string;
  membresActifs: number;
  tauxPresence: number;
  tauxAdoptionResolutions: number;
  tauxExecutionPlans: number;
  nbReunionsTenues: number;
  nbResolutionsAdoptees: number;
  nbPlansTermines: number;
  tempsMoyenExecutionJours: number;
}

interface KpiGlobal {
  commissions: KpiCommission[];
  tauxGouvernanceGlobal: number;
  nbAnomaliesResiduelles: number;
  nbDossiersClos: number;
  tauxRapportsPublies: number;
}

const COMM_COLORS: Record<string, string> = {
  FINANCE:            "blue",
  OPERATIONS_TERRAIN: "emerald",
  AUDIT_CONTROLE:     "amber",
  OPTIMISATION:       "violet",
};

const COLOR_CLASSES: Record<string, { bg: string; text: string; ring: string; bar: string }> = {
  blue:    { bg: "bg-blue-50",    text: "text-blue-700",    ring: "ring-blue-300",    bar: "bg-blue-500" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-300", bar: "bg-emerald-500" },
  amber:   { bg: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-300",   bar: "bg-amber-500" },
  violet:  { bg: "bg-violet-50",  text: "text-violet-700",  ring: "ring-violet-300",  bar: "bg-violet-500" },
};

function GaugeBar({ value, color = "blue", label }: { value: number; color?: string; label: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const cls = COLOR_CLASSES[color] || COLOR_CLASSES.blue;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className={`text-xs font-semibold ${pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-rose-600"}`}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${cls.bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function KpisPage() {
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<KpiGlobal>(
    `/api/admin/ria/commissions/gouvernance/kpis?_r=${refresh}`
  );

  const scoreColor = (v: number) => v >= 75 ? "text-emerald-600" : v >= 50 ? "text-amber-600" : "text-rose-600";

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" /> Indicateurs de Performance (KPIs)
          </h1>
          <p className="text-sm text-slate-500">Tableau de bord de performance des commissions de gouvernance</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-60">
          <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-slate-400">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Données KPI non disponibles</p>
        </div>
      ) : (
        <>
          {/* Score global */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-indigo-200 p-5 text-center col-span-2 md:col-span-1">
              <p className="text-xs text-slate-500 mb-1">Score gouvernance global</p>
              <p className={`text-4xl font-black ${scoreColor(data.tauxGouvernanceGlobal)}`}>
                {data.tauxGouvernanceGlobal.toFixed(0)}%
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
              <div className="flex items-center justify-center gap-1 text-rose-500 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-2xl font-bold text-slate-800">{data.nbAnomaliesResiduelles}</span>
              </div>
              <p className="text-xs text-slate-500">Anomalies résiduelles</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
              <div className="flex items-center justify-center gap-1 text-teal-500 mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-2xl font-bold text-slate-800">{data.nbDossiersClos}</span>
              </div>
              <p className="text-xs text-slate-500">Dossiers IC clos</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
              <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-2xl font-bold text-slate-800">{data.tauxRapportsPublies.toFixed(0)}%</span>
              </div>
              <p className="text-xs text-slate-500">Rapports publiés</p>
            </div>
          </div>

          {/* KPIs par commission */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {(data.commissions || []).map(c => {
              const colorKey = COMM_COLORS[c.type] || "blue";
              const cls = COLOR_CLASSES[colorKey];
              return (
                <div key={c.type} className={`bg-white rounded-xl border border-slate-200 overflow-hidden`}>
                  <div className={`px-5 py-3 ${cls.bg} flex items-center justify-between`}>
                    <h3 className={`font-semibold text-sm ${cls.text}`}>{c.label}</h3>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ring-1 ${cls.ring} ${cls.bg} ${cls.text}`}>
                      <Target className="w-3 h-3" />
                      Score global: {((c.tauxPresence + c.tauxAdoptionResolutions + c.tauxExecutionPlans) / 3).toFixed(0)}%
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Compteurs */}
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div>
                        <div className="flex items-center justify-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-lg font-bold text-slate-800">{c.membresActifs}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">Membres</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-lg font-bold text-slate-800">{c.nbReunionsTenues}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">Réunions</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1">
                          <Gavel className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-lg font-bold text-slate-800">{c.nbResolutionsAdoptees}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">Résolutions</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-lg font-bold text-slate-800">{c.tempsMoyenExecutionJours}j</span>
                        </div>
                        <p className="text-[10px] text-slate-400">Tps. moy.</p>
                      </div>
                    </div>

                    {/* Jauges */}
                    <div className="space-y-3">
                      <GaugeBar value={c.tauxPresence} color={colorKey} label="Taux de présence aux réunions" />
                      <GaugeBar value={c.tauxAdoptionResolutions} color={colorKey} label="Taux d'adoption des résolutions" />
                      <GaugeBar value={c.tauxExecutionPlans} color={colorKey} label="Taux d'exécution des plans d'action" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
