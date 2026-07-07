"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Wallet, ArrowLeft, Loader2, FileSpreadsheet, Printer, TrendingUp, TrendingDown,
  ShoppingCart, LineChart, Scale, UserX, Ban, Filter, Activity,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { exportToXlsx } from "@/lib/exportXlsx";
import ClienteleTabBar from "@/components/ClienteleTabBar";

type Granularite = "jour" | "semaine" | "mois" | "annee";

interface Etats {
  periode: { from: string; to: string; granularite: Granularite };
  soldeGlobal: number;
  nbComptes: number;
  totaux: { depots: number; retraits: number; utilisations: number };
  series: { key: string; label: string; depots: number; retraits: number; utilisations: number; net: number }[];
  evolution: { key: string; label: string; net: number; cumul: number }[];
  balance: { id: number; numeroCompte: string; codeAgence: string; statut: string; client: string; totalDepose: number; totalRetire: number; totalUtilise: number; solde: number }[];
  comptesSuspendus: { id: number; numeroCompte: string; solde: number; motif: string | null; derniereOperationAt: string | null; client: string }[];
  comptesInactifs: { id: number; numeroCompte: string; solde: number; dateOuverture: string; derniereOperationAt: string | null; client: string }[];
}

const GRANULARITES: [Granularite, string][] = [
  ["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"], ["annee", "Année"],
];

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

export default function EtatsCCPage() {
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1).toISOString().slice(0, 10);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);
  const [granularite, setGranularite] = useState<Granularite>("mois");

  const qs = new URLSearchParams({ from, to, granularite }).toString();
  const { data: res, loading } = useApi<{ data: Etats }>(`/api/comptes-courants/etats?${qs}`);
  const s = res?.data;

  const maxCumul = s ? Math.max(1, ...s.evolution.map((e) => Math.abs(e.cumul))) : 1;
  const maxFlux = s ? Math.max(1, ...s.series.map((r) => Math.max(r.depots, r.retraits, r.utilisations))) : 1;

  const exportSeries = () => {
    if (!s) return;
    exportToXlsx(
      s.series,
      [
        { label: "Période", key: "label", type: "text" },
        { label: "Dépôts", key: "depots", type: "currency" },
        { label: "Retraits", key: "retraits", type: "currency" },
        { label: "Utilisations (achats)", key: "utilisations", type: "currency" },
        { label: "Net", key: "net", type: "currency" },
      ],
      `CC_flux_${from}_${to}.xlsx`,
      { sheetName: "Flux par période", title: `Comptes Courants — Flux (${fmtDate(from)} → ${fmtDate(to)})` },
    );
  };

  const exportBalance = () => {
    if (!s) return;
    exportToXlsx(
      s.balance,
      [
        { label: "N° compte", key: "numeroCompte", type: "text" },
        { label: "Client", key: "client", type: "text" },
        { label: "Agence", key: "codeAgence", type: "text" },
        { label: "Statut", key: "statut", type: "text" },
        { label: "Total déposé", key: "totalDepose", type: "currency" },
        { label: "Total retiré", key: "totalRetire", type: "currency" },
        { label: "Total utilisé", key: "totalUtilise", type: "currency" },
        { label: "Solde", key: "solde", type: "currency" },
      ],
      `CC_balance_${today}.xlsx`,
      { sheetName: "Balance", title: "Comptes Courants — Balance des comptes" },
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <div className="print:hidden"><ClienteleTabBar /></div>

      <div className="p-6 max-w-screen-xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Scale className="w-6 h-6 text-emerald-600" /> États &amp; statistiques — Comptes Courants
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">Flux par période, évolution des soldes, balance et comptes à surveiller</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/admin/comptes-courants/tableau-de-bord"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" /> Tableau de bord
            </Link>
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">
              <Printer className="w-4 h-4" /> Imprimer / PDF
            </button>
          </div>
        </div>

        {/* Filtres de période */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-end gap-4 print:hidden">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-medium"><Filter className="w-4 h-4" /> Période</div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Du</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Au</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Regroupement</label>
            <select value={granularite} onChange={(e) => setGranularite(e.target.value as Granularite)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {GRANULARITES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        {/* Titre impression */}
        <div className="hidden print:block">
          <h1 className="text-xl font-bold">AFRISIME — États des Comptes Courants</h1>
          <p className="text-sm text-gray-600">Période : {fmtDate(from)} → {fmtDate(to)}</p>
        </div>

        {loading && !s ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-3" /> Chargement…</div>
        ) : !s ? (
          <p className="text-center py-20 text-gray-400">Aucune donnée.</p>
        ) : (
          <>
            {/* KPIs période */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Solde global (actuel)" value={formatCurrency(s.soldeGlobal)} icon={<Wallet className="w-5 h-5 text-emerald-600" />} bg="bg-emerald-50" />
              <Kpi label="Dépôts (période)" value={formatCurrency(s.totaux.depots)} icon={<TrendingUp className="w-5 h-5 text-teal-600" />} bg="bg-teal-50" />
              <Kpi label="Retraits (période)" value={formatCurrency(s.totaux.retraits)} icon={<TrendingDown className="w-5 h-5 text-orange-600" />} bg="bg-orange-50" />
              <Kpi label="Utilisation achats (période)" value={formatCurrency(s.totaux.utilisations)} icon={<ShoppingCart className="w-5 h-5 text-blue-600" />} bg="bg-blue-50" />
            </div>

            {/* Flux par période */}
            <Card title="Dépôts / Retraits / Utilisations par période" icon={<Activity />} action={
              <button onClick={exportSeries} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 print:hidden">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </button>
            }>
              {s.series.length === 0 ? <Empty /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-gray-400 uppercase border-b border-gray-100">
                      <tr>
                        <th className="text-left font-semibold py-2 px-2">Période</th>
                        <th className="text-left font-semibold py-2 px-2 w-1/2">Flux</th>
                        <th className="text-right font-semibold py-2 px-2">Dépôts</th>
                        <th className="text-right font-semibold py-2 px-2">Retraits</th>
                        <th className="text-right font-semibold py-2 px-2">Achats</th>
                        <th className="text-right font-semibold py-2 px-2">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {s.series.map((r) => (
                        <tr key={r.key}>
                          <td className="py-2 px-2 text-gray-700 whitespace-nowrap">{r.label}</td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1 h-4">
                              <span className="bg-teal-400 h-3 rounded-sm" style={{ width: `${(r.depots / maxFlux) * 100}%` }} title={`Dépôts ${formatCurrency(r.depots)}`} />
                              <span className="bg-orange-400 h-3 rounded-sm" style={{ width: `${(r.retraits / maxFlux) * 100}%` }} title={`Retraits ${formatCurrency(r.retraits)}`} />
                              <span className="bg-blue-400 h-3 rounded-sm" style={{ width: `${(r.utilisations / maxFlux) * 100}%` }} title={`Achats ${formatCurrency(r.utilisations)}`} />
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right text-teal-700">{formatCurrency(r.depots)}</td>
                          <td className="py-2 px-2 text-right text-orange-700">{formatCurrency(r.retraits)}</td>
                          <td className="py-2 px-2 text-right text-blue-700">{formatCurrency(r.utilisations)}</td>
                          <td className={`py-2 px-2 text-right font-semibold ${r.net < 0 ? "text-orange-600" : "text-emerald-600"}`}>
                            {r.net < 0 ? "−" : "+"} {formatCurrency(Math.abs(r.net))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Évolution des soldes (cumul du net) */}
            <Card title="Évolution des soldes (net cumulé sur la période)" icon={<LineChart />}>
              {s.evolution.length === 0 ? <Empty /> : (
                <div className="flex items-end gap-1 h-40 overflow-x-auto pt-4">
                  {s.evolution.map((e) => (
                    <div key={e.key} className="flex flex-col items-center gap-1 min-w-[38px] flex-1">
                      <div className="w-full bg-emerald-100 rounded-t relative flex items-end justify-center" style={{ height: `${(Math.abs(e.cumul) / maxCumul) * 100}%` }}>
                        <span className="w-full bg-emerald-500 rounded-t" style={{ height: "100%" }} />
                      </div>
                      <span className="text-[9px] text-gray-400 -rotate-45 origin-center whitespace-nowrap mt-1">{e.label}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-gray-400 mt-6">Cumul du solde net (dépôts − retraits − utilisations) depuis le début de la période.</p>
            </Card>

            {/* Balance des comptes */}
            <Card title="Balance des comptes courants" icon={<Scale />} action={
              <button onClick={exportBalance} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 print:hidden">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </button>
            }>
              {s.balance.length === 0 ? <Empty /> : (
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-gray-400 uppercase border-b border-gray-100 sticky top-0 bg-white">
                      <tr>
                        <th className="text-left font-semibold py-2 px-2">N° compte</th>
                        <th className="text-left font-semibold py-2 px-2">Client</th>
                        <th className="text-right font-semibold py-2 px-2">Déposé</th>
                        <th className="text-right font-semibold py-2 px-2">Retiré</th>
                        <th className="text-right font-semibold py-2 px-2">Utilisé</th>
                        <th className="text-right font-semibold py-2 px-2">Solde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {s.balance.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50/60">
                          <td className="py-2 px-2 font-mono text-xs text-gray-600">{c.numeroCompte}</td>
                          <td className="py-2 px-2 text-gray-800">{c.client}</td>
                          <td className="py-2 px-2 text-right text-teal-700">{formatCurrency(c.totalDepose)}</td>
                          <td className="py-2 px-2 text-right text-orange-700">{formatCurrency(c.totalRetire)}</td>
                          <td className="py-2 px-2 text-right text-blue-700">{formatCurrency(c.totalUtilise)}</td>
                          <td className="py-2 px-2 text-right font-bold text-gray-900">{formatCurrency(c.solde)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-gray-200 font-semibold">
                      <tr>
                        <td className="py-2 px-2" colSpan={5}>Solde global</td>
                        <td className="py-2 px-2 text-right text-emerald-700">{formatCurrency(s.soldeGlobal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Comptes inactifs */}
              <Card title={`Comptes inactifs (${s.comptesInactifs.length})`} icon={<UserX />}>
                {s.comptesInactifs.length === 0 ? <Empty label="Aucun compte inactif." /> : (
                  <div className="max-h-[360px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-gray-50">
                        {s.comptesInactifs.map((c) => (
                          <tr key={c.id} className="hover:bg-gray-50/60">
                            <td className="py-2 px-2">
                              <p className="font-medium text-gray-800">{c.client}</p>
                              <p className="text-[11px] text-gray-400 font-mono">{c.numeroCompte} · dern. op. {fmtDate(c.derniereOperationAt)}</p>
                            </td>
                            <td className="py-2 px-2 text-right font-semibold text-gray-700">{formatCurrency(c.solde)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* Comptes suspendus */}
              <Card title={`Comptes suspendus (${s.comptesSuspendus.length})`} icon={<Ban />}>
                {s.comptesSuspendus.length === 0 ? <Empty label="Aucun compte suspendu." /> : (
                  <div className="max-h-[360px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-gray-50">
                        {s.comptesSuspendus.map((c) => (
                          <tr key={c.id} className="hover:bg-gray-50/60">
                            <td className="py-2 px-2">
                              <p className="font-medium text-gray-800">{c.client}</p>
                              <p className="text-[11px] text-gray-400 font-mono">{c.numeroCompte}{c.motif ? ` · ${c.motif}` : ""}</p>
                            </td>
                            <td className="py-2 px-2 text-right font-semibold text-gray-700">{formatCurrency(c.solde)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, bg }: { label: string; value: string; icon: React.ReactNode; bg: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
      <div className={`${bg} p-2.5 rounded-xl shrink-0`}>{icon}</div>
      <div><p className="text-xs text-gray-500">{label}</p><p className="font-bold text-gray-900 text-lg">{value}</p></div>
    </div>
  );
}

function Card({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 print:shadow-none print:border-gray-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <span className="text-gray-400 [&>svg]:w-4 [&>svg]:h-4">{icon}</span> {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ label = "Aucune donnée sur la période." }: { label?: string }) {
  return <p className="text-center py-8 text-gray-400 text-sm">{label}</p>;
}
