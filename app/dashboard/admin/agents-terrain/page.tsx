"use client";

import React, { useState, useCallback } from 'react';
import {
  UserCheck, Search, RefreshCw, Users, Wallet,
  Phone, MapPin, Calendar, AlertTriangle,
  BarChart2, Eye, ArrowRightLeft, X, CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import ClienteleTabBar from '@/components/ClienteleTabBar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollecteDetail {
  terrain:        number; // CollecteJournaliere validées
  versements:     number; // VersementPack directs par l'agent
  remboursements: number; // RemboursementCredit enregistrés par l'agent
  ventes:         number; // VenteDirecte réalisées par l'agent
}

interface AgentStats {
  nbClients:            number;
  nbCreancesActives:    number;
  montantCreances:      number;
  montantCollecteCeMois:number;
  nbCollectesCeMois:    number;
  tauxRecouvrement:     number;
  totalVerse:           number;
  totalPacks:           number;
  derniereActivite:     string | null;
  collecteDetail:       CollecteDetail;
}

interface Agent {
  id:       number;
  memberId: number;
  actif:    boolean;
  zone:     string | null;
  member: {
    id: number; nom: string; prenom: string;
    email: string; telephone: string | null; etat: string;
    affectationsPDV: { pointDeVente: { id: number; nom: string; code: string } }[];
  };
  stats: AgentStats;
}

interface AgentsResponse {
  data: Agent[];
  stats: {
    total: number; actifs: number;
    totalClientsAffectes: number;
    totalCollecteCeMois: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TAUX_COLOR = (t: number) =>
  t >= 80 ? 'text-emerald-600' : t >= 50 ? 'text-amber-600' : 'text-red-600';

const TAUX_BG = (t: number) =>
  t >= 80 ? 'bg-emerald-500' : t >= 50 ? 'bg-amber-500' : 'bg-red-500';

function joursDepuis(dateStr: string | null) {
  if (!dateStr) return null;
  const j = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (j === 0) return "Aujourd'hui";
  if (j === 1) return 'Hier';
  return `Il y a ${j}j`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentsTerrainPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search,      setSearch]      = useState('');
  const [actifFilter, setActifFilter] = useState('');

  // Transfert portefeuille
  const [transferSource,   setTransferSource]   = useState<Agent | null>(null);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferLoading,  setTransferLoading]  = useState(false);
  const [transferError,    setTransferError]    = useState('');
  const [transferSuccess,  setTransferSuccess]  = useState('');

  const query = new URLSearchParams({
    ...(search      && { search }),
    ...(actifFilter && { actif: actifFilter }),
  }).toString();

  const { data: res, loading, refetch } = useApi<AgentsResponse>(
    `/api/admin/agents-terrain?${query}`
  );

  const handleSearch = useCallback(() => setSearch(searchInput), [searchInput]);

  const agents = res?.data ?? [];
  const stats  = res?.stats;

  const openTransfer = (agent: Agent) => {
    setTransferSource(agent);
    setTransferTargetId('');
    setTransferError('');
    setTransferSuccess('');
  };

  const handleTransfer = async () => {
    if (!transferSource || !transferTargetId) return;
    setTransferLoading(true);
    setTransferError('');
    setTransferSuccess('');
    try {
      const res = await fetch(
        `/api/admin/agents-terrain/${transferSource.memberId}/transferer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versAgentId: Number(transferTargetId) }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Erreur lors du transfert');
      setTransferSuccess(`${json.nbTransferes} client(s) transféré(s) avec succès.`);
      refetch();
    } catch (e: unknown) {
      setTransferError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ClienteleTabBar />

      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Supervision agents de terrain</h2>
            <p className="text-sm text-gray-500 mt-0.5">Performance, recouvrement et activité par agent</p>
          </div>
          <button onClick={refetch}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Agents actifs',    value: stats?.actifs ?? 0,                      icon: <UserCheck className="w-5 h-5 text-blue-600" />,    bg: 'bg-blue-50',    fmt: 'n' },
            { label: 'Clients affectés', value: stats?.totalClientsAffectes ?? 0,         icon: <Users className="w-5 h-5 text-violet-600" />,       bg: 'bg-violet-50',  fmt: 'n' },
            { label: 'Total agents',     value: stats?.total ?? 0,                        icon: <BarChart2 className="w-5 h-5 text-slate-600" />,    bg: 'bg-slate-50',   fmt: 'n' },
            { label: 'Collecté ce mois', value: formatCurrency(stats?.totalCollecteCeMois ?? 0), icon: <Wallet className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50', fmt: 'c' },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
              <div className={`${k.bg} p-2.5 rounded-xl shrink-0`}>{k.icon}</div>
              <div>
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`font-bold text-gray-900 ${k.fmt === 'n' ? 'text-2xl' : 'text-lg'}`}>{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[220px] flex gap-2">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Rechercher un agent…"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={handleSearch}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Search className="w-4 h-4" />
            </button>
          </div>
          <select value={actifFilter} onChange={(e) => setActifFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Tous</option>
            <option value="true">Actifs</option>
            <option value="false">Inactifs</option>
          </select>
          <span className="text-sm text-gray-400">{agents.length} agent(s)</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <UserCheck className="w-10 h-10 mb-2" />
              <p className="text-sm">Aucun agent de terrain trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Agent</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Zone</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Clients</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Créances actives</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Collecté ce mois</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Taux recouvrement</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Dernière activité</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Statut</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {agents.map((agent) => {
                    const pdv = agent.member.affectationsPDV[0]?.pointDeVente ?? null;
                    return (
                      <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                        {/* Agent */}
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900">
                            {agent.member.prenom} {agent.member.nom}
                          </p>
                          {agent.member.telephone && (
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                              <Phone className="w-3 h-3" />{agent.member.telephone}
                            </div>
                          )}
                          {pdv && (
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                              <MapPin className="w-3 h-3" />{pdv.nom}
                            </div>
                          )}
                        </td>

                        {/* Zone */}
                        <td className="px-4 py-3">
                          {agent.zone ? (
                            <span className="inline-flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                              <MapPin className="w-3 h-3" />{agent.zone}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>

                        {/* Nb clients */}
                        <td className="px-4 py-3 text-center">
                          <span className="text-lg font-bold text-gray-900">{agent.stats.nbClients}</span>
                        </td>

                        {/* Créances */}
                        <td className="px-4 py-3 text-center">
                          <span className={`text-lg font-bold ${agent.stats.nbCreancesActives > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                            {agent.stats.nbCreancesActives}
                          </span>
                          {agent.stats.montantCreances > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(agent.stats.montantCreances)}</p>
                          )}
                        </td>

                        {/* Collecté ce mois — tooltip détail des 4 sources */}
                        <td className="px-4 py-3 text-right">
                          <div className="group relative inline-block w-full">
                            <p className="font-semibold text-emerald-700 cursor-help underline decoration-dotted decoration-emerald-400">
                              {formatCurrency(agent.stats.montantCollecteCeMois)}
                            </p>

                            {/* Tooltip détail */}
                            <div className="absolute right-0 top-full mt-1 z-20 hidden group-hover:block w-64 bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-left">
                              <p className="text-xs font-semibold text-gray-700 mb-2">Détail — ce mois</p>
                              <div className="space-y-1.5">
                                {[
                                  { label: 'Collectes terrain',       value: agent.stats.collecteDetail.terrain,        color: 'text-blue-600' },
                                  { label: 'Versements packs directs', value: agent.stats.collecteDetail.versements,     color: 'text-violet-600' },
                                  { label: 'Remboursements crédits',  value: agent.stats.collecteDetail.remboursements, color: 'text-orange-600' },
                                  { label: 'Ventes directes',         value: agent.stats.collecteDetail.ventes,         color: 'text-emerald-600' },
                                ].map((row) => (
                                  <div key={row.label} className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-500 truncate">{row.label}</span>
                                    <span className={`text-xs font-semibold shrink-0 ${row.value > 0 ? row.color : 'text-gray-300'}`}>
                                      {formatCurrency(row.value)}
                                    </span>
                                  </div>
                                ))}
                                <div className="border-t border-gray-100 pt-1.5 flex items-center justify-between">
                                  <span className="text-xs font-semibold text-gray-700">Total</span>
                                  <span className="text-xs font-bold text-emerald-700">{formatCurrency(agent.stats.montantCollecteCeMois)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Taux recouvrement */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-lg font-bold ${TAUX_COLOR(agent.stats.tauxRecouvrement)}`}>
                              {agent.stats.tauxRecouvrement}%
                            </span>
                            <div className="w-20 bg-gray-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${TAUX_BG(agent.stats.tauxRecouvrement)}`}
                                style={{ width: `${agent.stats.tauxRecouvrement}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Dernière activité */}
                        <td className="px-4 py-3">
                          {agent.stats.derniereActivite ? (
                            <div>
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Calendar className="w-3 h-3" />
                                {formatDate(agent.stats.derniereActivite)}
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {joursDepuis(agent.stats.derniereActivite)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-400" /> Aucune collecte
                            </span>
                          )}
                        </td>

                        {/* Statut */}
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${
                            agent.actif ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {agent.actif ? 'Actif' : 'Inactif'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Link
                              href={`/dashboard/admin/agents-terrain/${agent.memberId}`}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                            >
                              <Eye className="w-3 h-3" /> Détail
                            </Link>
                            <button
                              onClick={() => openTransfer(agent)}
                              title="Transférer le portefeuille"
                              className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 px-2 py-1 rounded hover:bg-violet-50"
                            >
                              <ArrowRightLeft className="w-3 h-3" /> Transférer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal transfert portefeuille */}
      {transferSource && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Transférer le portefeuille</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  De <span className="font-medium text-gray-700">{transferSource.member.prenom} {transferSource.member.nom}</span>
                  {' '}({transferSource.stats.nbClients} client(s))
                </p>
              </div>
              <button
                onClick={() => setTransferSource(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Avertissement */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Tous les clients de cet agent seront réaffectés à l&apos;agent sélectionné. L&apos;historique des affectations est conservé.</p>
              </div>

              {/* Sélection agent destination */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agent destination</label>
                <select
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">— Choisir un agent —</option>
                  {agents
                    .filter((a) => a.memberId !== transferSource.memberId)
                    .map((a) => (
                      <option key={a.memberId} value={a.memberId}>
                        {a.member.prenom} {a.member.nom}
                        {a.zone ? ` · ${a.zone}` : ''}
                        {' '}({a.stats.nbClients} clients)
                      </option>
                    ))}
                </select>
              </div>

              {/* Feedback */}
              {transferError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{transferError}</p>
              )}
              {transferSuccess && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />{transferSuccess}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setTransferSource(null)}
                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleTransfer}
                disabled={!transferTargetId || transferLoading || !!transferSuccess}
                className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {transferLoading
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Transfert…</>
                  : <><ArrowRightLeft className="w-4 h-4" /> Confirmer le transfert</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
