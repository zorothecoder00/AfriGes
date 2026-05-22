"use client";

import React, { useState } from 'react';
import {
  BarChart2, Download, RefreshCw, TrendingUp, TrendingDown,
  Users, Calendar, Wallet, AlertTriangle, UserCheck,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import { exportToCsv } from '@/lib/exportCsv';
import ClienteleTabBar from '@/components/ClienteleTabBar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecouvrementData {
  global: { nb: number; totalPacks: number; totalVerse: number; totalRestant: number; tauxGlobal: number };
  parTypePack: { type: string; nb: number; total: number; verse: number; restant: number; taux: number }[];
  parAgent:    { agentId: number; nom: string; nb: number; total: number; verse: number; restant: number; taux: number }[];
  parPdv:      { pdvId: number; nom: string; code: string; nb: number; total: number; verse: number; restant: number; taux: number }[];
  evolution:   { label: string; montant: number; nb: number }[];
}

interface CollectesData {
  global:    { nbTotal: number; totalPrevu: number; totalCollecte: number; tauxRealisation: number };
  parStatut: { statut: string; nb: number; montant: number }[];
  parAgent:  { agentId: number; nom: string; nbCollectes: number; montantCollecte: number }[];
  parJour:   { date: string; montant: number; nb: number }[];
}

interface CreancesData {
  global: { nbCreances: number; totalRestant: number; totalPacks: number; totalVerse: number; tauxRecouvrement: number };
  parAnciennete: { label: string; nb: number; montant: number; color: string }[];
  parAgent:      { agentId: number; nom: string; nb: number; montant: number }[];
  parPdv:        { pdvId: number; nom: string; code: string; nb: number; montant: number }[];
}

interface AgentsData {
  data: {
    agentId: number; nom: string; telephone: string | null; actif: boolean;
    nbClients: number; nbSouscriptions: number;
    totalPacks: number; totalVerse: number; totalRestant: number;
    tauxRecouvrement: number; nbCollectes: number; montantCollecte: number;
    score: number;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TAUX_BAR = (t: number) =>
  t >= 80 ? 'bg-emerald-500' : t >= 50 ? 'bg-amber-500' : 'bg-red-500';

const ANCIENNETE_COLOR: Record<string, string> = {
  emerald: 'bg-emerald-500', amber: 'bg-amber-500',
  orange:  'bg-orange-500',  red:   'bg-red-500', rose: 'bg-rose-600',
};

type TabId = 'recouvrement' | 'collectes' | 'creances' | 'agents';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RapportsPage() {
  const [tab,       setTab]       = useState<TabId>('recouvrement');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin,   setDateFin]   = useState('');

  const dateQuery = new URLSearchParams({
    ...(dateDebut && { dateDebut }),
    ...(dateFin   && { dateFin }),
  }).toString();

  const recouv  = useApi<RecouvrementData>(`/api/admin/rapports/recouvrement?${dateQuery}`);
  const collect = useApi<CollectesData>(`/api/admin/rapports/collectes?${dateQuery}`);
  const creances = useApi<CreancesData>('/api/admin/rapports/creances');
  const agents  = useApi<AgentsData>(`/api/admin/rapports/agents?${dateQuery}`);

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'recouvrement', label: 'Recouvrement',  icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'collectes',    label: 'Collectes',      icon: <Calendar className="w-4 h-4" /> },
    { id: 'creances',     label: 'Créances',       icon: <TrendingDown className="w-4 h-4" /> },
    { id: 'agents',       label: 'Agents',         icon: <UserCheck className="w-4 h-4" /> },
  ];

  const isLoading = tab === 'recouvrement' ? recouv.loading
    : tab === 'collectes' ? collect.loading
    : tab === 'creances'  ? creances.loading
    : agents.loading;

  const refetchCurrent = () => {
    if (tab === 'recouvrement') recouv.refetch();
    else if (tab === 'collectes') collect.refetch();
    else if (tab === 'creances')  creances.refetch();
    else agents.refetch();
  };

  // ── Exports ──────────────────────────────────────────────────────────────────
  const exportRecouvrement = () => {
    const rows = recouv.data?.parAgent ?? [];
    exportToCsv(rows, [
      { label: 'Agent',           key: 'nom' },
      { label: 'Nb souscriptions',key: 'nb' },
      { label: 'Total packs',     key: 'total',   format: (v) => String(v) },
      { label: 'Versé',           key: 'verse',   format: (v) => String(v) },
      { label: 'Restant',         key: 'restant', format: (v) => String(v) },
      { label: 'Taux (%)',        key: 'taux' },
    ], `rapport-recouvrement-${new Date().toISOString().slice(0,10)}.csv`);
  };

  const exportCollectes = () => {
    const rows = collect.data?.parAgent ?? [];
    exportToCsv(rows, [
      { label: 'Agent',       key: 'nom' },
      { label: 'Collectes',   key: 'nbCollectes' },
      { label: 'Montant (FCFA)', key: 'montantCollecte', format: (v) => String(v) },
    ], `rapport-collectes-${new Date().toISOString().slice(0,10)}.csv`);
  };

  const exportCreances = () => {
    const rows = creances.data?.parPdv ?? [];
    exportToCsv(rows, [
      { label: 'PDV',             key: 'nom' },
      { label: 'Code',            key: 'code' },
      { label: 'Nb créances',     key: 'nb' },
      { label: 'Montant restant', key: 'montant', format: (v) => String(v) },
    ], `rapport-creances-${new Date().toISOString().slice(0,10)}.csv`);
  };

  const exportAgents = () => {
    const rows = agents.data?.data ?? [];
    exportToCsv(rows, [
      { label: 'Agent',            key: 'nom' },
      { label: 'Clients',          key: 'nbClients' },
      { label: 'Souscriptions',    key: 'nbSouscriptions' },
      { label: 'Taux recouvrement', key: 'tauxRecouvrement', format: (v) => `${v}%` },
      { label: 'Collectes',        key: 'nbCollectes' },
      { label: 'Montant collecté', key: 'montantCollecte', format: (v) => String(v) },
    ], `rapport-agents-${new Date().toISOString().slice(0,10)}.csv`);
  };

  const handleExport = () => {
    if (tab === 'recouvrement') exportRecouvrement();
    else if (tab === 'collectes') exportCollectes();
    else if (tab === 'creances')  exportCreances();
    else exportAgents();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ClienteleTabBar />

      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Rapports & Exports</h2>
            <p className="text-sm text-gray-500 mt-0.5">Analyses détaillées du module clientèle</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm">
              <Download className="w-4 h-4" /> Exporter CSV
            </button>
            <button onClick={refetchCurrent}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filtre dates + onglets */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Onglets */}
          <div className="flex border-b border-gray-200 px-4 pt-4 gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                  tab === t.id
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* Filtres date (sauf créances qui est un snapshot) */}
          {tab !== 'creances' && (
            <div className="px-6 py-4 flex items-center gap-4 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Période
              </span>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" />
              <span className="text-gray-400 text-sm">→</span>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" />
              {(dateDebut || dateFin) && (
                <button onClick={() => { setDateDebut(''); setDateFin(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline">
                  Tout effacer
                </button>
              )}
            </div>
          )}

          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
              </div>
            ) : (
              <>
                {tab === 'recouvrement' && recouv.data  && <TabRecouvrement  data={recouv.data} />}
                {tab === 'collectes'    && collect.data && <TabCollectes    data={collect.data} />}
                {tab === 'creances'     && creances.data && <TabCreances    data={creances.data} />}
                {tab === 'agents'       && agents.data  && <TabAgents       data={agents.data} />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab Recouvrement ─────────────────────────────────────────────────────────

function TabRecouvrement({ data }: { data: RecouvrementData }) {
  const g = data.global;
  const maxEvo = Math.max(...data.evolution.map((e) => e.montant), 1);
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Souscriptions"    value={String(g.nb)}                        icon={<Wallet className="w-5 h-5 text-blue-600" />}    bg="bg-blue-50" />
        <StatBox label="Total packs"      value={formatCurrency(g.totalPacks)}         icon={<BarChart2 className="w-5 h-5 text-violet-600" />} bg="bg-violet-50" />
        <StatBox label="Versé"            value={formatCurrency(g.totalVerse)}         icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} bg="bg-emerald-50" />
        <StatBox label="Taux global"      value={`${g.tauxGlobal}%`}                  icon={<TrendingDown className="w-5 h-5 text-orange-600" />} bg="bg-orange-50" />
      </div>

      {/* Évolution */}
      {data.evolution.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">Évolution des versements</p>
          <div className="flex items-end gap-2 h-28 bg-gray-50 rounded-xl p-4">
            {data.evolution.map((e) => {
              const h = Math.max(4, Math.round((e.montant / maxEvo) * 100));
              return (
                <div key={e.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-gray-400">{e.montant > 0 ? `${Math.round(e.montant/1000)}K` : ''}</span>
                  <div className="w-full rounded-t bg-blue-500 hover:bg-blue-600" style={{ height: `${h}%` }}
                    title={`${e.label} : ${formatCurrency(e.montant)}`} />
                  <span className="text-[9px] text-gray-400">{e.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Par agent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RankTable
          title="Par agent" icon={<Users className="w-4 h-4 text-blue-600" />}
          rows={data.parAgent.slice(0, 8)}
          cols={[
            { label: 'Agent',   render: (r) => r.nom },
            { label: 'Nb',      render: (r) => String(r.nb),            cls: 'text-right text-gray-600' },
            { label: 'Versé',   render: (r) => formatCurrency(r.verse), cls: 'text-right text-emerald-600 font-semibold' },
            { label: 'Taux',    render: (r) => (
              <div className="flex items-center gap-2">
                <div className="w-16 bg-gray-100 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${TAUX_BAR(r.taux)}`} style={{ width: `${r.taux}%` }} />
                </div>
                <span className="text-xs font-bold">{r.taux}%</span>
              </div>
            ) },
          ]}
        />

        <RankTable
          title="Par type de pack" icon={<BarChart2 className="w-4 h-4 text-violet-600" />}
          rows={data.parTypePack}
          cols={[
            { label: 'Type',   render: (r) => r.type },
            { label: 'Nb',     render: (r) => String(r.nb), cls: 'text-right text-gray-600' },
            { label: 'Versé',  render: (r) => formatCurrency(r.verse), cls: 'text-right text-emerald-600 font-semibold' },
            { label: 'Taux',   render: (r) => `${r.taux}%`, cls: 'text-right font-bold' },
          ]}
        />
      </div>
    </div>
  );
}

// ─── Tab Collectes ────────────────────────────────────────────────────────────

function TabCollectes({ data }: { data: CollectesData }) {
  const g = data.global;
  const maxJour = Math.max(...data.parJour.map((j) => j.montant), 1);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Total collectes"    value={String(g.nbTotal)}                  icon={<Calendar className="w-5 h-5 text-teal-600" />}    bg="bg-teal-50" />
        <StatBox label="Montant prévu"      value={formatCurrency(g.totalPrevu)}        icon={<BarChart2 className="w-5 h-5 text-blue-600" />}   bg="bg-blue-50" />
        <StatBox label="Montant encaissé"   value={formatCurrency(g.totalCollecte)}     icon={<Wallet className="w-5 h-5 text-emerald-600" />}   bg="bg-emerald-50" />
        <StatBox label="Taux réalisation"   value={`${g.tauxRealisation}%`}             icon={<TrendingUp className="w-5 h-5 text-orange-600" />} bg="bg-orange-50" />
      </div>

      {/* Par statut */}
      <div className="flex flex-wrap gap-3">
        {data.parStatut.map((s) => (
          <div key={s.statut} className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3 border border-gray-200">
            <span className="text-sm font-medium text-gray-700">{s.statut}</span>
            <span className="text-lg font-bold text-gray-900">{s.nb}</span>
            <span className="text-sm text-gray-500">{formatCurrency(s.montant)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution par jour */}
        {data.parJour.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Collectes par jour</p>
            <div className="flex items-end gap-1 h-28 bg-gray-50 rounded-xl p-3 overflow-x-auto">
              {data.parJour.slice(-30).map((j) => {
                const h = Math.max(4, Math.round((j.montant / maxJour) * 100));
                return (
                  <div key={j.date} className="flex-1 min-w-[12px] flex flex-col items-center">
                    <div className="w-full rounded-t bg-teal-500 hover:bg-teal-600" style={{ height: `${h}%` }}
                      title={`${formatDate(j.date)} : ${formatCurrency(j.montant)}`} />
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1 text-center">30 derniers jours avec collectes</p>
          </div>
        )}

        {/* Par agent */}
        <RankTable
          title="Par agent" icon={<Users className="w-4 h-4 text-teal-600" />}
          rows={data.parAgent.slice(0, 8)}
          cols={[
            { label: 'Agent',      render: (r) => r.nom },
            { label: 'Collectes',  render: (r) => String(r.nbCollectes), cls: 'text-right text-gray-600' },
            { label: 'Encaissé',   render: (r) => formatCurrency(r.montantCollecte), cls: 'text-right text-emerald-600 font-semibold' },
          ]}
        />
      </div>
    </div>
  );
}

// ─── Tab Créances ─────────────────────────────────────────────────────────────

function TabCreances({ data }: { data: CreancesData }) {
  const g = data.global;
  const maxAnc = Math.max(...data.parAnciennete.map((a) => a.montant), 1);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Créances ouvertes"  value={String(g.nbCreances)}              icon={<AlertTriangle className="w-5 h-5 text-orange-600" />} bg="bg-orange-50" />
        <StatBox label="Montant dû"         value={formatCurrency(g.totalRestant)}     icon={<TrendingDown className="w-5 h-5 text-red-600" />}     bg="bg-red-50" />
        <StatBox label="Versé total"        value={formatCurrency(g.totalVerse)}       icon={<Wallet className="w-5 h-5 text-emerald-600" />}       bg="bg-emerald-50" />
        <StatBox label="Taux recouvrement"  value={`${g.tauxRecouvrement}%`}           icon={<TrendingUp className="w-5 h-5 text-blue-600" />}      bg="bg-blue-50" />
      </div>

      {/* Répartition ancienneté */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Répartition par ancienneté du retard</p>
        <div className="space-y-2">
          {data.parAnciennete.map((a) => {
            const pct = maxAnc > 0 ? Math.round((a.montant / maxAnc) * 100) : 0;
            return (
              <div key={a.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-28 shrink-0">{a.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                  <div className={`h-5 rounded-full ${ANCIENNETE_COLOR[a.color]}`} style={{ width: `${pct}%` }} />
                  <span className="absolute inset-y-0 right-2 flex items-center text-xs font-semibold text-white" style={{ opacity: pct > 15 ? 1 : 0 }}>
                    {a.nb}
                  </span>
                </div>
                <span className="text-xs font-semibold text-gray-700 w-28 text-right shrink-0">
                  {formatCurrency(a.montant)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RankTable
          title="Par agent terrain" icon={<Users className="w-4 h-4 text-orange-600" />}
          rows={data.parAgent.slice(0, 8)}
          cols={[
            { label: 'Agent',    render: (r) => r.nom },
            { label: 'Créances', render: (r) => String(r.nb), cls: 'text-right text-gray-600' },
            { label: 'Montant',  render: (r) => formatCurrency(r.montant), cls: 'text-right text-red-600 font-semibold' },
          ]}
        />
        <RankTable
          title="Par point de vente" icon={<BarChart2 className="w-4 h-4 text-blue-600" />}
          rows={data.parPdv.slice(0, 8)}
          cols={[
            { label: 'PDV',      render: (r) => `${r.nom} (${r.code})` },
            { label: 'Créances', render: (r) => String(r.nb), cls: 'text-right text-gray-600' },
            { label: 'Montant',  render: (r) => formatCurrency(r.montant), cls: 'text-right text-red-600 font-semibold' },
          ]}
        />
      </div>
    </div>
  );
}

// ─── Tab Agents ───────────────────────────────────────────────────────────────

function TabAgents({ data }: { data: AgentsData }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Classement des agents par score de performance (taux recouvrement + activité collectes)</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Agent</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Clients</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Souscriptions</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Versé</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Taux</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Collectes</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Montant collecté</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.data.map((a, i) => (
              <tr key={a.agentId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700'
                    : i === 1 ? 'bg-gray-200 text-gray-600'
                    : i === 2 ? 'bg-orange-100 text-orange-700'
                    : 'bg-slate-100 text-slate-500'
                  }`}>{i+1}</span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{a.nom}</td>
                <td className="px-4 py-3 text-center text-gray-700">{a.nbClients}</td>
                <td className="px-4 py-3 text-center text-gray-700">{a.nbSouscriptions}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatCurrency(a.totalVerse)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-16 bg-gray-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${TAUX_BAR(a.tauxRecouvrement)}`} style={{ width: `${a.tauxRecouvrement}%` }} />
                    </div>
                    <span className="text-xs font-bold">{a.tauxRecouvrement}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-gray-700">{a.nbCollectes}</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-700">{formatCurrency(a.montantCollecte)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Composants réutilisables ─────────────────────────────────────────────────

function StatBox({ label, value, icon, bg }: { label: string; value: string; icon: React.ReactNode; bg: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
      <div className={`${bg} p-2.5 rounded-xl shrink-0`}>{icon}</div>
      <div><p className="text-xs text-gray-500">{label}</p><p className="font-bold text-gray-900 text-lg">{value}</p></div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RankTable<T extends Record<string, any>>({ title, icon, rows, cols }: {
  title: string;
  icon:  React.ReactNode;
  rows:  T[];
  cols:  { label: string; render: (r: T) => React.ReactNode; cls?: string }[];
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">{icon}{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Aucune donnée</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{cols.map((c) => <th key={c.label} className="px-3 py-2 font-semibold text-gray-600 text-left">{c.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {cols.map((c) => <td key={c.label} className={`px-3 py-2 ${c.cls ?? ''}`}>{c.render(r)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
