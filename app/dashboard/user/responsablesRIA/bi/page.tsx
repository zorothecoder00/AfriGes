"use client";

import { RefreshCw, TrendingUp, Wallet, Users, AlertTriangle } from "lucide-react";
import { useApi } from "@/hooks/useApi";

interface KPIs {
  capitalTotal: number; capitalDisponible: number; capitalEngage: number;
  capitalRecouvre: number; beneficesGeneres: number; beneficesDistribues: number;
  fondSecurite: number; nbPortefeuilles: number; nbInvestisseurs: number;
  nbFinancementsActifs: number; nbFinancementsEnRetard: number;
  totalEncours: number; tauxRecouvrement: number;
}
interface Portefeuille {
  id: number; reference: string; nom: string | null; investisseur: string;
  capitalInvesti: number; capitalDisponible: number; capitalEngage: number; beneficesGeneres: number;
}
interface Prevision  { jours: number; montantAttendu: number }
interface RisqueItem { classe: string; count: number }
interface EvolutionItem { mois: number; annee: number; distribue: number; genere: number }

interface BIData {
  kpis: KPIs;
  top10Portefeuilles: Portefeuille[];
  previsionsTresorerie: Prevision[];
  encoursEchus: number;
  repartitionRisque: RisqueItem[];
  evolutionMensuelle: EvolutionItem[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);

const MOIS = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jui", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const CLASSE_COLORS: Record<string, string> = {
  A: "bg-emerald-500", B: "bg-green-400", C: "bg-yellow-400", D: "bg-orange-400", E: "bg-red-500",
};
const CLASSE_TEXT: Record<string, string> = {
  A: "text-emerald-700 bg-emerald-50", B: "text-green-700 bg-green-50",
  C: "text-yellow-700 bg-yellow-50",   D: "text-orange-700 bg-orange-50",
  E: "text-red-700 bg-red-50",
};

function BarChart({ items, max, color = "#10b981" }: { items: { label: string; value: number }[]; max: number; color?: string }) {
  const W = 480; const H = 160; const PAD = 40; const BAR_W = 28;
  const innerW = W - PAD * 2;
  const step   = items.length > 0 ? innerW / items.length : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      {items.map((item, i) => {
        const barH = max > 0 ? ((item.value / max) * (H - PAD - 20)) : 0;
        const x    = PAD + i * step + (step - BAR_W) / 2;
        const y    = H - PAD - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={BAR_W} height={barH} rx={3} fill={color} opacity={0.85} />
            <text x={x + BAR_W / 2} y={H - PAD + 14} textAnchor="middle" fontSize={9} fill="#64748b">{item.label}</text>
          </g>
        );
      })}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#e2e8f0" strokeWidth={1} />
    </svg>
  );
}

function KCard({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${accent ? "text-emerald-700" : "text-slate-800"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function BIPage() {
  const { data, loading, refetch } = useApi<BIData>("/api/admin/ria/bi");

  if (loading) return (
    <div className="p-8 flex items-center justify-center text-slate-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
    </div>
  );
  if (!data) return <div className="p-8 text-slate-500">Aucune donnée disponible.</div>;

  const { kpis, top10Portefeuilles, previsionsTresorerie, encoursEchus, repartitionRisque, evolutionMensuelle } = data;
  const maxCapital   = Math.max(...top10Portefeuilles.map((p) => p.capitalInvesti), 1);
  const maxEvolution = Math.max(...evolutionMensuelle.map((e) => e.genere), 1);
  const totalRisque  = repartitionRisque.reduce((s, r) => s + r.count, 0);
  const maxPrevision = Math.max(...previsionsTresorerie.map((p) => p.montantAttendu), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Business Intelligence — RIA</h1>
          <p className="text-sm text-slate-500 mt-0.5">Analyse globale · Top investisseurs · Prévisions trésorerie</p>
        </div>
        <button onClick={refetch}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KCard accent label="Capital total investi"   value={fmt(kpis.capitalTotal)}      sub={`${kpis.nbInvestisseurs} investisseurs · ${kpis.nbPortefeuilles} portefeuilles`} />
        <KCard label="Capital disponible"             value={fmt(kpis.capitalDisponible)}  sub="Fonds non engagés" />
        <KCard label="Capital engagé (encours)"       value={fmt(kpis.capitalEngage)}      sub={`${kpis.nbFinancementsActifs} financements actifs`} />
        <KCard label="Bénéfices générés"              value={fmt(kpis.beneficesGeneres)}   sub={`Distribués : ${fmt(kpis.beneficesDistribues)}`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KCard label="Capital recouvré"   value={fmt(kpis.capitalRecouvre)}   sub={`Taux recouvrement : ${kpis.tauxRecouvrement}%`} />
        <KCard label="Fonds de sécurité"  value={fmt(kpis.fondSecurite)} />
        <KCard label="Encours total"      value={fmt(kpis.totalEncours)}      sub={`${kpis.nbFinancementsActifs} actifs`} />
        <div className={`rounded-xl border p-4 ${kpis.nbFinancementsEnRetard > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
          <p className="text-xs text-slate-500 mb-1">Financements en retard</p>
          <p className={`text-xl font-bold ${kpis.nbFinancementsEnRetard > 0 ? "text-red-700" : "text-slate-800"}`}>
            {kpis.nbFinancementsEnRetard}
          </p>
          {encoursEchus > 0 && <p className="text-xs text-red-400 mt-0.5">{fmt(encoursEchus)} échus</p>}
        </div>
      </div>

      {encoursEchus > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span><strong>{fmt(encoursEchus)}</strong> d&apos;encours sont en retard de paiement. Consultez la page Recouvrement pour les détails.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold text-slate-800">Top 10 Portefeuilles</h2>
            <span className="ml-auto text-xs text-slate-400">par capital investi</span>
          </div>
          <div className="p-4">
            <BarChart items={top10Portefeuilles.map((p, i) => ({ label: `PF${i + 1}`, value: p.capitalInvesti }))} max={maxCapital} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Portefeuille</th>
                  <th className="px-4 py-2 text-left">Investisseur</th>
                  <th className="px-4 py-2 text-right">Investi</th>
                  <th className="px-4 py-2 text-right">Engagé</th>
                  <th className="px-4 py-2 text-right">Bénéfices</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {top10Portefeuilles.map((pf, i) => (
                  <tr key={pf.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-bold text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{pf.reference}</div>
                      {pf.nom && <div className="text-slate-400">{pf.nom}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{pf.investisseur}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                      {fmt(pf.capitalInvesti)}
                      <div className="mt-0.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${maxCapital > 0 ? (pf.capitalInvesti / maxCapital) * 100 : 0}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{fmt(pf.capitalEngage)}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-600">{fmt(pf.beneficesGeneres)}</td>
                  </tr>
                ))}
                {top10Portefeuilles.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Aucun portefeuille</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <h2 className="font-semibold text-slate-800">Scoring de risque</h2>
          </div>
          <div className="p-5 space-y-3">
            {["A", "B", "C", "D", "E"].map((c) => {
              const item  = repartitionRisque.find((r) => r.classe === c);
              const count = item?.count ?? 0;
              const pct   = totalRisque > 0 ? Math.round((count / totalRisque) * 100) : 0;
              return (
                <div key={c}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={`px-2 py-0.5 rounded-full font-bold ${CLASSE_TEXT[c]}`}>Classe {c}</span>
                    <span className="text-slate-500">{count} affectation{count !== 1 ? "s" : ""} · {pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${CLASSE_COLORS[c]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {totalRisque === 0 && <p className="text-sm text-slate-400 text-center py-4">Aucune affectation active</p>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-blue-600" />
          <h2 className="font-semibold text-slate-800">Prévisions trésorerie</h2>
          <span className="ml-auto text-xs text-slate-400">Encours attendus par horizon (cumulatif)</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-5 gap-4">
            {previsionsTresorerie.map(({ jours, montantAttendu }) => {
              const pct = maxPrevision > 0 ? (montantAttendu / maxPrevision) * 100 : 0;
              return (
                <div key={jours} className="text-center">
                  <div className="relative mx-auto w-16 mb-2" style={{ height: 80 }}>
                    <div className="absolute bottom-0 w-full bg-slate-100 rounded-t-md overflow-hidden" style={{ height: 80 }}>
                      <div className="absolute bottom-0 w-full bg-blue-500 rounded-t-md transition-all" style={{ height: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-xs font-bold text-slate-700">J+{jours}</div>
                  <div className="text-xs text-blue-600 font-medium mt-0.5">
                    {montantAttendu > 0 ? fmt(montantAttendu) : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {evolutionMensuelle.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold text-slate-800">Évolution des bénéfices — 12 mois</h2>
          </div>
          <div className="p-5">
            <BarChart
              items={evolutionMensuelle.map((e) => ({ label: `${MOIS[e.mois]} ${String(e.annee).slice(2)}`, value: e.genere }))}
              max={maxEvolution} color="#10b981"
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-500 uppercase">
                  <tr>
                    <th className="text-left py-1.5">Période</th>
                    <th className="text-right py-1.5">Générés</th>
                    <th className="text-right py-1.5">Distribués</th>
                    <th className="text-right py-1.5">Taux distrib.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {evolutionMensuelle.map((e) => (
                    <tr key={`${e.annee}-${e.mois}`} className="hover:bg-slate-50">
                      <td className="py-1.5 text-slate-700">{MOIS[e.mois]} {e.annee}</td>
                      <td className="py-1.5 text-right text-emerald-600">{fmt(e.genere)}</td>
                      <td className="py-1.5 text-right text-slate-600">{fmt(e.distribue)}</td>
                      <td className="py-1.5 text-right text-slate-400">
                        {e.genere > 0 ? `${Math.round((e.distribue / e.genere) * 100)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
