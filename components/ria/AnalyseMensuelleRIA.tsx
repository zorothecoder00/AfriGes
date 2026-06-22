"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import {
  CalendarRange, RefreshCw, Users, Wallet, PieChart,
  ShieldCheck, Eye, AlertTriangle, XCircle,
} from "lucide-react";

interface Bucket { montant: number; nb: number }
interface AnalyseMensuelle {
  mois: number; annee: number; libelle: string;
  clients: { sains: number; surveillance: number; risques: number; critiques: number; total: number };
  creances: { saines: Bucket; aRisque: Bucket; douteuses: Bucket; perdues: Bucket; total: number };
  portefeuille: {
    capitalInvesti: number; capitalEngage: number; beneficesGeneres: number;
    totalFinance: number; totalRembourse: number;
    rentabilite: number; rotation: number; productivite: number; tauxUtilisation: number;
  };
}

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export default function AnalyseMensuelleRIA() {
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<{ data: AnalyseMensuelle }>(`/api/admin/ria/analyse-mensuelle?_r=${refresh}`);
  const a = data?.data;

  return (
    <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-brand-50 to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-700 flex items-center justify-center">
            <CalendarRange className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 leading-tight">Analyse mensuelle</h2>
            <p className="text-xs text-slate-500 capitalize">{a?.libelle ?? "mois courant"}</p>
          </div>
        </div>
        <button onClick={() => setRefresh((r) => r + 1)}
          className="p-2 text-slate-400 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors" title="Actualiser">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {!a && loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : !a ? (
        <p className="text-sm text-slate-400 text-center py-10">Aucune donnée disponible</p>
      ) : (
        <div className="p-5 space-y-6">
          {/* 1 ─ Analyse des clients */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
              <Users className="w-4 h-4 text-brand-600" /> Clients
              <span className="text-xs font-normal text-slate-400">· {a.clients.total} financé(s)</span>
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Sains",            sub: "0 j de retard",  val: a.clients.sains,        Icon: ShieldCheck,    cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
                { label: "Sous surveillance",sub: "< 7 j",          val: a.clients.surveillance, Icon: Eye,            cls: "bg-amber-50 border-amber-200 text-amber-700" },
                { label: "Risqués",          sub: "7 – 30 j",       val: a.clients.risques,      Icon: AlertTriangle,  cls: "bg-orange-50 border-orange-200 text-orange-700" },
                { label: "Critiques",        sub: "> 30 j",         val: a.clients.critiques,    Icon: XCircle,        cls: "bg-rose-50 border-rose-200 text-rose-700" },
              ].map(({ label, sub, val, Icon, cls }) => (
                <div key={label} className={`border rounded-xl p-3.5 ${cls}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <Icon className="w-4 h-4" />
                    <span className="text-2xl font-bold">{val}</span>
                  </div>
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="text-[11px] opacity-70">{sub} · {pct(val, a.clients.total)}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2 ─ Analyse des créances */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
              <Wallet className="w-4 h-4 text-brand-600" /> Créances
              <span className="text-xs font-normal text-slate-400">· encours {formatCurrency(a.creances.total)}</span>
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Saines",    sub: "à jour",      b: a.creances.saines,    cls: "bg-emerald-50 border-emerald-200 text-emerald-700", bar: "bg-emerald-400" },
                { label: "À risque",  sub: "1 – 30 j",    b: a.creances.aRisque,   cls: "bg-amber-50 border-amber-200 text-amber-700",       bar: "bg-amber-400" },
                { label: "Douteuses", sub: "31 – 90 j",   b: a.creances.douteuses, cls: "bg-orange-50 border-orange-200 text-orange-700",    bar: "bg-orange-400" },
                { label: "Perdues",   sub: "> 90 j / défaut", b: a.creances.perdues, cls: "bg-rose-50 border-rose-200 text-rose-700",        bar: "bg-rose-500" },
              ].map(({ label, sub, b, cls, bar }) => (
                <div key={label} className={`border rounded-xl p-3.5 ${cls}`}>
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="text-[11px] opacity-70 mb-1.5">{sub} · {b.nb} créance(s)</p>
                  <p className="text-base font-bold leading-tight">{formatCurrency(b.montant)}</p>
                  <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct(b.montant, a.creances.total)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3 ─ Analyse du portefeuille */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
              <PieChart className="w-4 h-4 text-brand-600" /> Portefeuille
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Rentabilité",      value: `${a.portefeuille.rentabilite.toFixed(1)} %`,     hint: "Bénéfices / Capital investi" },
                { label: "Rotation capital", value: `${a.portefeuille.rotation.toFixed(2)} cycles`,   hint: "Financé / Capital investi" },
                { label: "Productivité",     value: `${a.portefeuille.productivite.toFixed(1)} %`,    hint: "Recouvrement / Fonds engagés" },
                { label: "Taux d'utilisation", value: `${a.portefeuille.tauxUtilisation.toFixed(1)} %`, hint: "Engagé / Capital investi" },
              ].map(({ label, value, hint }) => (
                <div key={label} className="border border-slate-200 rounded-xl p-3.5 bg-gradient-to-br from-brand-50/60 to-white">
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <p className="text-xl font-bold text-brand-700 mt-0.5">{value}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{hint}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
