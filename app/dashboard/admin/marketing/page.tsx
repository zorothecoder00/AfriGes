"use client";

import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import KpiCard from "@/components/ui/KpiCard";
import {
  Wallet, Receipt, Megaphone, CheckCircle2, UserPlus, RotateCcw,
  TrendingUp, PiggyBank, Target, Percent, BarChart3, Loader2,
} from "lucide-react";

interface StatsResponse {
  data: {
    totaux: {
      budgetPrevu: number; budgetApprouve: number; depenses: number;
      campagnesActives: number; campagnesTerminees: number;
      leadsGeneres: number; nouveauxClients: number; clientsReactives: number;
      ventesAttribuees: number; caAttribue: number; margeAttribuee: number;
      coutParLead: number | null; cac: number | null;
      tauxConversion: number | null; roi: number | null; roas: number | null;
      engagement: number | null; tauxRetention: number | null;
    };
    parAgence: { pointDeVenteId: number; nom: string; code: string; budget: number; leads: number; clients: number; caAttribue: number; roi: number | null }[];
    topCampagnes: { id: number; code: string; nom: string; statut: string; caAttribue: number }[];
  };
}

const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(0)} %`);

export default function MarketingDashboardPage() {
  const { data: res, loading } = useApi<StatsResponse>("/api/admin/marketing/stats");
  const s = res?.data.totaux;

  if (loading && !res) {
    return <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!s) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Marketing AfriSime</h2>
        <p className="text-slate-500 text-sm mt-0.5">Ce qu&apos;on a fait en marketing, et ce que ça a rapporté — ce mois.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Budget prévu"       value={s.budgetPrevu}       format={formatCurrency} icon={<Wallet size={18} />}     accent="primary" />
        <KpiCard label="Dépenses"           value={s.depenses}          format={formatCurrency} icon={<Receipt size={18} />}    accent="warning" />
        <KpiCard label="Campagnes actives"  value={s.campagnesActives}                          icon={<Megaphone size={18} />} accent="brand" />
        <KpiCard label="Campagnes terminées" value={s.campagnesTerminees}                        icon={<CheckCircle2 size={18} />} accent="neutral" />

        <KpiCard label="Nouveaux clients"   value={s.nouveauxClients}                           icon={<UserPlus size={18} />}   accent="success" />
        <KpiCard label="Clients réactivés"  value={s.clientsReactives}                          icon={<RotateCcw size={18} />}  accent="teal" />
        <KpiCard label="CA attribué"        value={s.caAttribue}        format={formatCurrency} icon={<TrendingUp size={18} />} accent="success" />
        <KpiCard label="Marge attribuée"    value={s.margeAttribuee}    format={formatCurrency} icon={<PiggyBank size={18} />}  accent="purple" />

        <KpiCard label="Coût d'acquisition" value={s.cac ?? 0}          format={s.cac !== null ? formatCurrency : undefined} icon={<Target size={18} />} accent="warning"
          sub={s.cac === null ? "Pas encore de client attribué" : undefined} />
        <KpiCard label="ROI"                value={s.roi ?? 0}          format={(n) => pct(s.roi === null ? null : n)} icon={<Percent size={18} />} accent={s.roi !== null && s.roi >= 0 ? "success" : "error"}
          sub={s.roi === null ? "Pas encore de dépense" : undefined} />
        <KpiCard label="ROAS"               value={s.roas ?? 0}         format={(n) => (s.roas === null ? "—" : `× ${n.toFixed(1)}`)} icon={<BarChart3 size={18} />} accent="brand" />
        <KpiCard label="Ventes attribuées"  value={s.ventesAttribuees}                          icon={<Megaphone size={18} />} accent="neutral" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-3">Comparatif par agence</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100">
                  <th className="py-2 pr-2">Agence</th>
                  <th className="py-2 pr-2 text-right">Budget</th>
                  <th className="py-2 pr-2 text-right">Clients</th>
                  <th className="py-2 pr-2 text-right">CA attribué</th>
                  <th className="py-2 text-right">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(res?.data.parAgence ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400">Aucune agence ciblée par une campagne pour l&apos;instant</td></tr>
                ) : res!.data.parAgence.map((a) => (
                  <tr key={a.pointDeVenteId}>
                    <td className="py-2 pr-2 font-medium text-slate-700">{a.nom}</td>
                    <td className="py-2 pr-2 text-right text-slate-500">{formatCurrency(a.budget)}</td>
                    <td className="py-2 pr-2 text-right text-slate-500">{a.clients}</td>
                    <td className="py-2 pr-2 text-right font-semibold text-slate-800">{formatCurrency(a.caAttribue)}</td>
                    <td className={`py-2 text-right font-semibold ${a.roi !== null && a.roi >= 0 ? "text-emerald-600" : "text-slate-400"}`}>{pct(a.roi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-3">Top campagnes (CA attribué)</h3>
          <div className="space-y-2">
            {(res?.data.topCampagnes ?? []).length === 0 ? (
              <p className="text-center text-slate-400 py-6">Aucune campagne pour l&apos;instant</p>
            ) : res!.data.topCampagnes.map((c, i) => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-fuchsia-100 text-fuchsia-700 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.nom}</p>
                    <p className="text-xs text-slate-400">{c.code}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-slate-800 shrink-0">{formatCurrency(c.caAttribue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
