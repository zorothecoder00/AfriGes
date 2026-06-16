"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, BarChart2, TrendingUp, Users } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface DashData {
  capitalInvesti: number; capitalEngage: number; capitalDisponible: number;
  nbClientsFinances: number; tauxRemboursement: number; rendementMoyen: number;
  beneficesGeneres: number; scoreGlobalSante: number;
  nbInvestisseurs?: number; nbPortefeuilles?: number;
}
interface InvResponse { data: unknown[]; meta: { total: number } }
interface PfResponse  { data: unknown[]; meta: { total: number } }

export default function ProductivitePage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data: dash } = useApi<DashData>(`/api/admin/ria/dashboard?_r=${refresh}`);
  const { data: invData } = useApi<InvResponse>(`/api/admin/ria/investisseurs?limit=1&_r=${refresh}`);
  const { data: pfData  } = useApi<PfResponse>(`/api/admin/ria/portefeuilles?limit=1&_r=${refresh}`);

  if (type !== "optimisation") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Optimisation.</div>
  );

  const toNum = (v: unknown) => Number(v ?? 0);
  const nbInv = invData?.meta.total ?? 0;
  const nbPf  = pfData?.meta.total  ?? 0;
  const nbClients = toNum(dash?.nbClientsFinances);

  const kpis = dash ? [
    {
      label: "Clients par investisseur",
      value: nbInv > 0 ? (nbClients / nbInv).toFixed(1) : "—",
      sub: `${nbClients} clients / ${nbInv} investisseurs`,
      color: "text-blue-700",
      benchmark: "Cible : ≥5",
      ok: nbInv > 0 && (nbClients / nbInv) >= 5,
    },
    {
      label: "Capital moyen / portefeuille",
      value: nbPf > 0 ? formatCurrency(toNum(dash.capitalInvesti) / nbPf) : "—",
      sub: `${nbPf} portefeuilles`,
      color: "text-violet-700",
      benchmark: "Cible : ≥500k",
      ok: nbPf > 0 && toNum(dash.capitalInvesti) / nbPf >= 500_000,
    },
    {
      label: "Taux d&apos;utilisation du capital",
      value: toNum(dash.capitalInvesti) > 0
        ? `${(toNum(dash.capitalEngage) / toNum(dash.capitalInvesti) * 100).toFixed(1)}%`
        : "—",
      sub: "Capital engagé / investi",
      color: "text-amber-700",
      benchmark: "Cible : 70–90%",
      ok: toNum(dash.capitalInvesti) > 0 && (() => {
        const t = toNum(dash.capitalEngage) / toNum(dash.capitalInvesti) * 100;
        return t >= 70 && t <= 90;
      })(),
    },
    {
      label: "Bénéfices / capital investi",
      value: toNum(dash.capitalInvesti) > 0
        ? `${(toNum(dash.beneficesGeneres) / toNum(dash.capitalInvesti) * 100).toFixed(1)}%`
        : "—",
      sub: `${formatCurrency(toNum(dash.beneficesGeneres))} générés`,
      color: "text-emerald-700",
      benchmark: "Cible : ≥10%",
      ok: toNum(dash.capitalInvesti) > 0 && toNum(dash.beneficesGeneres) / toNum(dash.capitalInvesti) * 100 >= 10,
    },
  ] : [];

  const ratios = dash ? [
    { label: "Rendement moyen",      value: toNum(dash.rendementMoyen),    suffix: "%", cible: 12, sens: "gt" as const },
    { label: "Taux remboursement",   value: toNum(dash.tauxRemboursement), suffix: "%", cible: 80, sens: "gt" as const },
    { label: "Score santé global",   value: toNum(dash.scoreGlobalSante),  suffix: "/100", cible: 75, sens: "gt" as const },
  ] : [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Productivité</h1>
          <p className="text-sm text-slate-500">Indicateurs de productivité et benchmarks cibles RIA</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* KPI productivité */}
      <div className="grid grid-cols-2 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-start justify-between mb-2">
              <p className="text-sm text-slate-500">{k.label.replace(/&apos;/g, "'")}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${k.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {k.ok ? "Atteint" : "Non atteint"}
              </span>
            </div>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
            <p className="text-xs text-slate-300 mt-1">{k.benchmark}</p>
          </div>
        ))}
      </div>

      {/* Ratios */}
      {ratios.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-violet-500" />
            <h2 className="font-semibold text-slate-800">Ratios de performance</h2>
          </div>
          <div className="space-y-4">
            {ratios.map(r => {
              const pct = Math.min(100, r.value);
              const ok  = r.sens === "gt" ? r.value >= r.cible : r.value <= r.cible;
              return (
                <div key={r.label}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-slate-700">{r.label}</p>
                    <div className="flex items-center gap-2">
                      <p className={`text-lg font-bold ${ok ? "text-emerald-700" : "text-amber-700"}`}>
                        {r.value.toFixed(1)}{r.suffix}
                      </p>
                      <span className="text-xs text-slate-400">cible {r.cible}{r.suffix}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
                    <div className={`h-full rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`}
                      style={{ width: `${pct}%` }} />
                    <div className="absolute top-0 h-full w-0.5 bg-slate-400"
                      style={{ left: `${Math.min(100, r.cible)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Volume d'activité */}
      {dash && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-blue-500" />
            <h2 className="font-semibold text-slate-800">Volume d&apos;activité</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-black text-violet-700">{nbInv}</p>
              <p className="text-xs text-slate-500">Investisseurs actifs</p>
            </div>
            <div>
              <p className="text-3xl font-black text-blue-700">{nbPf}</p>
              <p className="text-xs text-slate-500">Portefeuilles</p>
            </div>
            <div>
              <p className="text-3xl font-black text-emerald-700">{nbClients}</p>
              <p className="text-xs text-slate-500">Clients financés</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <p className="text-sm text-slate-700">
              Capital total mobilisé : <strong className="text-blue-700">{formatCurrency(toNum(dash.capitalInvesti))}</strong>
              &nbsp;· Bénéfices générés : <strong className="text-emerald-700">{formatCurrency(toNum(dash.beneficesGeneres))}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
