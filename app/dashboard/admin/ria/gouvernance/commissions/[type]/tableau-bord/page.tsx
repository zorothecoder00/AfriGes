"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, TrendingUp, Wallet, Activity, BarChart3, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface DashData {
  capitalInvesti: number; capitalDisponible: number; capitalEngage: number;
  encoursGlobal: number; tauxRemboursement: number; rendementMoyen: number;
  tauxDefaut: number; scoreGlobalSante: number; nbClientsFinances: number;
  beneficesGeneres: number; montantRecouvreDuMois: number; coutRisque: number;
  navGlobale: number; tauxReinvestissement: number;
}

function KpiCard({ label, value, sub, color = "text-slate-800", icon: Icon }: {
  label: string; value: string; sub?: string; color?: string; icon: React.ElementType;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-slate-500">{label}</p>
        <Icon className="w-4 h-4 text-slate-300" />
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function TableauBordFinancePage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data: res, loading } = useApi<{ data: DashData }>(`/api/admin/ria/dashboard?kpis=1&_r=${refresh}`);

  if (type !== "finance") return (
    <div className="p-6 text-center text-slate-400 text-sm">Cette section est réservée à la Commission Finance.</div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-60">
      <div className="w-7 h-7 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  const data = res?.data;
  if (!data) return null;

  const sante = data.scoreGlobalSante ?? 0;
  const santeColor = sante >= 75 ? "text-emerald-600" : sante >= 50 ? "text-amber-600" : "text-rose-600";

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Tableau de Bord Financier</h1>
          <p className="text-sm text-slate-500">Vue consolidée des indicateurs financiers RIA</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Fonds investis" value={formatCurrency(data.capitalInvesti)} icon={Wallet} color="text-blue-700" />
        <KpiCard label="Fonds engagés" value={formatCurrency(data.capitalEngage)} icon={Activity} color="text-amber-700" />
        <KpiCard label="Fonds disponibles" value={formatCurrency(data.capitalDisponible)} icon={CheckCircle2} color="text-emerald-700" />
        <KpiCard label="NAV Globale" value={formatCurrency(data.navGlobale)} icon={BarChart3} color="text-violet-700" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Encours actif" value={formatCurrency(data.encoursGlobal)} sub="Financements ACTIF + EN_RETARD" icon={TrendingUp} />
        <KpiCard label="Recouvrement du mois" value={formatCurrency(data.montantRecouvreDuMois)} icon={CheckCircle2} color="text-emerald-600" />
        <KpiCard label="Bénéfices générés" value={formatCurrency(data.beneficesGeneres)} icon={TrendingUp} color="text-emerald-700" />
        <KpiCard label="Clients financés" value={String(data.nbClientsFinances)} sub="affectations actives" icon={Activity} />
      </div>

      {/* Ratios de performance */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Ratios de performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: "Taux de remboursement", value: data.tauxRemboursement, suffix: "%", color: data.tauxRemboursement >= 80 ? "text-emerald-600" : "text-amber-600" },
            { label: "Rendement moyen", value: data.rendementMoyen, suffix: "%", color: "text-blue-600" },
            { label: "Taux de défaut", value: data.tauxDefaut, suffix: "%", color: data.tauxDefaut < 5 ? "text-emerald-600" : "text-rose-600" },
            { label: "Coût du risque", value: data.coutRisque, suffix: "%", color: data.coutRisque < 10 ? "text-emerald-600" : "text-rose-600" },
          ].map(({ label, value, suffix, color }) => (
            <div key={label}>
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value.toFixed(1)}{suffix}</p>
              <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color.includes("emerald") ? "bg-emerald-400" : color.includes("rose") ? "bg-rose-400" : "bg-amber-400"}`}
                  style={{ width: `${Math.min(100, value)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Score de santé */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-6">
        <div className="text-center">
          <p className={`text-5xl font-black ${santeColor}`}>{sante}</p>
          <p className="text-xs text-slate-500 mt-1">Score santé global</p>
        </div>
        <div className="flex-1">
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${sante >= 75 ? "bg-emerald-400" : sante >= 50 ? "bg-amber-400" : "bg-rose-400"}`}
              style={{ width: `${sante}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>0 — Critique</span><span>50 — Moyen</span><span>100 — Excellent</span>
          </div>
          <p className="text-sm text-slate-600 mt-2">
            {sante >= 75 ? "Portefeuille sain — performance satisfaisante" : sante >= 50 ? "Performance correcte — vigilance recommandée" : "Situation préoccupante — action immédiate requise"}
          </p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-slate-800">{data.tauxReinvestissement.toFixed(1)}%</p>
          <p className="text-xs text-slate-500">Taux réinvestissement</p>
        </div>
      </div>

      {/* Alerte défaut si >5% */}
      {data.tauxDefaut > 5 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-rose-700">Taux de défaut élevé ({data.tauxDefaut.toFixed(1)}%)</p>
            <p className="text-xs text-rose-600 mt-0.5">Un plan de recouvrement renforcé est recommandé. Transmettez un dossier à la Commission Audit.</p>
          </div>
        </div>
      )}
    </div>
  );
}
