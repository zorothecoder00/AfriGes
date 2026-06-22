"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface Anomalie {
  id: string; type: "EN_RETARD" | "FAIBLE_RECOUVREMENT"; severite: "CRITIQUE" | "HAUTE" | "MOYENNE";
  description: string; client: string; investisseur: string;
  montant: number; ref: string;
}
interface FinancementsStats {
  anomalies: { total: number; critiques: number; hautes: number; items: Anomalie[] };
}
interface StatsResponse { data: FinancementsStats }

const SEV_STYLE: Record<string, string> = {
  CRITIQUE: "bg-rose-50 border-rose-200 text-rose-700",
  HAUTE:    "bg-orange-50 border-orange-200 text-orange-700",
  MOYENNE:  "bg-yellow-50 border-yellow-200 text-yellow-700",
};

export default function AnomaliesPage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<StatsResponse>(`/api/admin/ria/gouvernance/financements-stats?_r=${refresh}`);

  if (type !== "audit-controle") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Audit & Contrôle.</div>
  );

  // Détection d'anomalies calculée côté serveur sur l'ensemble des financements.
  const stats     = data?.data.anomalies;
  const anomalies = stats?.items ?? [];
  const critiques = stats?.critiques ?? 0;
  const hautes    = stats?.hautes ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Gestion des Anomalies</h1>
          <p className="text-sm text-slate-500">Détection automatique des irrégularités dans les financements</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className={`border rounded-xl p-4 text-center ${critiques > 0 ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"}`}>
          <ShieldAlert className={`w-5 h-5 mx-auto mb-1 ${critiques > 0 ? "text-rose-500" : "text-slate-300"}`} />
          <p className={`text-2xl font-bold ${critiques > 0 ? "text-rose-700" : "text-slate-400"}`}>{critiques}</p>
          <p className="text-xs text-slate-500">Anomalies critiques</p>
        </div>
        <div className={`border rounded-xl p-4 text-center ${hautes > 0 ? "bg-orange-50 border-orange-200" : "bg-white border-slate-200"}`}>
          <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${hautes > 0 ? "text-orange-500" : "text-slate-300"}`} />
          <p className={`text-2xl font-bold ${hautes > 0 ? "text-orange-700" : "text-slate-400"}`}>{hautes}</p>
          <p className="text-xs text-slate-500">Hautes</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <CheckCircle2 className={`w-5 h-5 mx-auto mb-1 ${(stats?.total ?? 0) === 0 ? "text-emerald-500" : "text-slate-300"}`} />
          <p className={`text-2xl font-bold ${(stats?.total ?? 0) === 0 ? "text-emerald-600" : "text-slate-800"}`}>{stats?.total ?? 0}</p>
          <p className="text-xs text-slate-500">Total anomalies</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : anomalies.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          <p className="text-slate-600 font-medium">Aucune anomalie détectée</p>
          <p className="text-slate-400 text-sm">Tous les financements sont conformes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...anomalies].sort((a, b) => {
            const order: Record<string, number> = { CRITIQUE: 0, HAUTE: 1, MOYENNE: 2 };
            return order[a.severite] - order[b.severite];
          }).map(a => (
            <div key={a.id} className={`border rounded-xl p-4 ${SEV_STYLE[a.severite]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">{a.description}</p>
                    <p className="text-xs mt-0.5">Client : {a.client} · Investisseur : {a.investisseur}</p>
                    <p className="text-xs font-mono mt-0.5">Réf. {a.ref} · Impact : {formatCurrency(a.montant)}</p>
                  </div>
                </div>
                <span className="text-xs font-bold flex-shrink-0 border border-current rounded px-1.5 py-0.5">
                  {a.severite}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
