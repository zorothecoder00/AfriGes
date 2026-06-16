"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  ListChecks, RefreshCw, AlertTriangle, CheckCircle2,
  Clock, Calendar, ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface PlanAction {
  id: number;
  titre: string;
  description: string | null;
  typeCommission: string;
  statut: string;
  priorite: string;
  progression: number;
  dateEcheance: string | null;
  enRetard?: boolean;
  resolution: { numero: string; titre: string } | null;
}

interface Data { plans: (PlanAction & { enRetard: boolean })[] }

const STATUTS: Record<string, string> = {
  A_FAIRE:      "bg-slate-100 text-slate-600",
  NON_DEMARRE:  "bg-slate-100 text-slate-500",
  EN_COURS:     "bg-blue-100 text-blue-700",
  TERMINE:      "bg-emerald-100 text-emerald-700",
  REALISE:      "bg-emerald-100 text-emerald-700",
  EN_RETARD:    "bg-rose-100 text-rose-700",
  ABANDONNE:    "bg-slate-100 text-slate-400",
};

const COMM_LABELS: Record<string, string> = {
  FINANCE:           "Finance",
  OPERATIONS_TERRAIN:"Opérations",
  AUDIT:             "Audit",
  OPTIMISATION:      "Optimisation",
};

export default function MesPlansActionsPage() {
  const [filterStatut, setFilterStatut] = useState("");
  const [showRetard, setShowRetard] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const params = new URLSearchParams();
  if (filterStatut) params.set("statut", filterStatut);
  if (refresh > 0) params.set("_r", String(refresh));
  const { data, loading } = useApi<Data>(`/api/membreCommission/plans-actions?${params.toString()}`);

  const allPlans = data?.plans || [];
  const plans = showRetard ? allPlans.filter(p => p.enRetard) : allPlans;
  const nbRetard = allPlans.filter(p => p.enRetard).length;

  async function updateProgression(id: number) {
    const val = window.prompt("Progression (0-100) :");
    if (val === null) return;
    const num = Math.min(100, Math.max(0, parseInt(val)));
    if (isNaN(num)) { toast.error("Valeur invalide"); return; }
    const res = await fetch(`/api/admin/ria/commissions/gouvernance/plans-actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progression: num }),
    });
    const json = await res.json();
    if (json?.id) { toast.success("Progression mise à jour"); setRefresh(r => r + 1); }
    else toast.error(json?.error || "Erreur");
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/user/responsablesRIA/gouvernance"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Gouvernance
          </Link>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-teal-600" /> Mes Plans d&apos;Action
          </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRetard(!showRetard)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-all ${showRetard ? "border-rose-400 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600"}`}>
            <AlertTriangle className="w-3.5 h-3.5" /> En retard ({nbRetard})
          </button>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="">Tous statuts</option>
            {Object.keys(STATUTS).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <button onClick={() => setRefresh(r => r + 1)} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{allPlans.length}</p>
          <p className="text-xs text-slate-500">Total</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{allPlans.filter(p => p.statut === "EN_COURS").length}</p>
          <p className="text-xs text-slate-500">En cours</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{allPlans.filter(p => ["TERMINE", "REALISE"].includes(p.statut)).length}</p>
          <p className="text-xs text-slate-500">Terminés</p>
        </div>
        <div className={`rounded-xl p-4 text-center border ${nbRetard > 0 ? "border-rose-200 bg-rose-50" : "bg-white border-slate-200"}`}>
          <p className={`text-2xl font-bold ${nbRetard > 0 ? "text-rose-700" : "text-slate-400"}`}>{nbRetard}</p>
          <p className="text-xs text-slate-500">En retard</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <ListChecks className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aucun plan d&apos;action assigné</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(p => (
            <div key={p.id} className={`bg-white rounded-xl border p-5 ${p.enRetard ? "border-rose-200 bg-rose-50/30" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUTS[p.statut] || "bg-slate-100 text-slate-600"}`}>
                      {p.statut}
                    </span>
                    <span className="text-xs text-slate-400">{COMM_LABELS[p.typeCommission] || p.typeCommission}</span>
                    {p.enRetard && (
                      <span className="text-xs text-rose-600 flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> En retard
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">{p.titre}</h3>
                  {p.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{p.description}</p>}
                  {p.resolution && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Résolution {p.resolution.numero} — {p.resolution.titre}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {p.dateEcheance && (
                    <p className={`text-xs flex items-center gap-1 ${p.enRetard ? "text-rose-600 font-medium" : "text-slate-400"}`}>
                      <Calendar className="w-3 h-3" />
                      {new Date(p.dateEcheance).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                  {!["TERMINE", "REALISE", "ABANDONNE"].includes(p.statut) && (
                    <button onClick={() => updateProgression(p.id)}
                      className="text-xs px-2 py-1 text-teal-600 border border-teal-200 rounded hover:bg-teal-50">
                      Mettre à jour
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${p.progression >= 100 ? "bg-emerald-500" : p.enRetard ? "bg-rose-400" : "bg-teal-500"}`}
                    style={{ width: `${p.progression}%` }} />
                </div>
                <span className="text-xs text-slate-500 shrink-0">{p.progression}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
